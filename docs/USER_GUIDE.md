# Expense Tracker — User Guide

This guide describes what the Expense Tracker does and how to run and use it day to day.

## What it is

Expense Tracker is a web application for **recording expenses** and **viewing spending by time period**. Each user has a private account: your expenses are not visible to other users.

You can:

- **Register** and **sign in** with email and password, or **sign in with Google, GitHub, GitLab, or Microsoft** when the server administrator has configured **OAuth** (open authorization) for those providers  
- **Add expenses** with amount, transaction date, category, how often the cost occurs, an optional **day of the month (1 through 30)** for when the payment is made, how you paid, and an optional note  
- **Import** a **comma-separated values or PDF** statement, **review** each line, set **categories** (and frequency or payment day if needed), then commit the import (see below)  
- **Delete** expenses from the list  
- **View reports** as charts: daily, weekly, monthly, yearly, or a custom date range  
- See **stored monthly summaries** (totals computed by a background job on a schedule)

The interface is **responsive**: it works on phones, tablets, and desktops.

---

## Before you start (developers and self-hosted)

You need **three** things running for the app to work end to end:

| Piece | Purpose |
|--------|---------|
| **PostgreSQL** | Stores users, expenses, OAuth identity links in the `oauth_identities` table, and related data |
| **Redis** (optional but recommended) | Caches report responses for faster repeated requests |
| **Node API** (`server/`) | Representational State Transfer backend, **JSON Web Token** authentication, and optional **OAuth**-based single sign-on |

The **browser application** (`client/`) is separate and talks to the API through the Vite development proxy or whatever routing you configure in deployment.

Quick local setup:

1. Start databases: run `docker compose up -d` from the project root  
2. Configure `server/.env` (copy from `server/.env.example`)  
3. Start the API: change to the `server` directory, run `npm install`, then `npm run dev`  
4. Start the web user interface: change to the `client` directory, run `npm install`, then `npm run dev`  
5. Open **http://localhost:5173** in your browser

If **port 4000** is already used by another program, the user interface may fail to reach the API. Set `PORT` in `server/.env` (for example `4001`) and set `API_PROXY_TARGET` in `client/.env` to the same host and port. See the root **README.md** for details.

---

## Account: register and sign in

1. Open the application URL in your browser.  
2. Choose **Create account** (or open the `/register` route).  
3. Enter **email** and **password** (minimum length is enforced on the form).  
4. After success you are signed in and taken to **Your expenses** if you already have saved expenses, otherwise to **Import** (add or import).  

To sign in later, use **Sign in** and open the `/login` route with the same email and password.

### Sign in with Google, GitHub, GitLab, or Microsoft

If your deployment has **OAuth** configured on the API, the **Sign in** and **Create account** screens show buttons for those providers. Choosing one sends you to that company’s site to approve access; you are then redirected back to the application at the `/oauth/callback` route and signed in with a normal session.

**Self-hosted setup:** In each provider’s developer console, register an OAuth application whose **redirect URI** is exactly this pattern, with no extra path segments:

`{your application origin}/api/auth/oauth/{provider}/callback`

Replace `{provider}` with `google`, `github`, `gitlab`, or `microsoft` depending on which console you are editing.

For example, with `CLIENT_ORIGIN=http://localhost:5173` and Google, the redirect URL is `http://localhost:5173/api/auth/oauth/google/callback`. The Vite development server proxies `/api` to the Node API, so this URL still reaches the backend. Set the `OAUTH_*` variables in `server/.env` as described in `server/.env.example`.

If you already registered with **email and password**, signing in with single sign-on using the **same email** links to the same account when the provider returns that email address.

**Sign out** clears your session in the browser (you will need to sign in again to use **Import** and **Reports**).

---

## Import screen

The **Import** page at `/expenses` is where you add and review individual transactions.

- **First-time users with no saved expenses:** you see the **manual add** form and **Import from statement** so you can enter data or upload a file. After you save at least one expense, the layout changes.  
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

On the **Your expenses** page, the table lists your expenses (newest first). **Projection** in the table header opens a **combined** report: **daily**, **monthly**, and **yearly** run-rate totals across **all** saved expenses (one-time amounts summed separately), plus a **pie chart** of annualized share by category (and a **One-time** slice when applicable). Click a slice to list the expenses in that segment; click the same slice again to clear. Each row also has **Projection** for **that expense only** (same numbers plus a single-slice or small pie); if you are editing a row, row **Projection** uses your unsaved values in the form. Click **Enter modification mode** to show **Edit** on each row; then **Edit**, **Save**, and **Cancel** work as before. Click **Exit modification mode** to go back to read-only rows (unsaved edits on the active row are cleared). **Delete** is always available. If you have no expenses yet, that page offers a link back to **Import** to add or import.

### Import from a statement (comma-separated values or PDF)

Under **Import from statement**:

1. Set **financial institution**, **frequency**, and optionally **Date (1 through 30)** for the import (or **From statement** so each row uses that line’s calendar day, capped at 30). **Institution** applies to every row you commit.  
2. Choose a **.csv** or **.pdf** file and click **Upload and parse**.  
3. In **Review import**, pick a **category** for each row you want to keep. Change **frequency** or **Date (1 through 30)** on a row if needed. Rows left as **— Select category —** are **not** imported.  
4. Click **Add categorized rows to expenses**. **Discard import** deletes the staged batch without saving expenses.

Parsing uses **date, amount, and description** from the file; **comma-separated values** usually work best. **PDF** support is best-effort.

---

## Reports screen

The **Reports** page shows **charts** of spending for different periods.

Use the tabs:

- **Daily** — pick a date; total and (if applicable) category breakdown.  
- **Weekly** — current week (Monday through Sunday in UTC-based logic) or adjust via the API; the default user interface uses the server’s current week.  
- **Monthly** — pick year and month.  
- **Yearly** — totals by month for a year.  
- **Custom range** — start and end dates.  

Each view shows a **bar chart** (Recharts library) and a **total** for the period. **Click the trend chart** (or focus it and press Enter or Space) to open the same **Projection** modal as on **Your expenses** — combined daily, monthly, and yearly run rates, pie chart, and slice drill-down — using your **saved expenses** (up to 500 rows). The bar chart reflects the **selected report period**; the projection is always **all saved expenses**, not filtered to that period.

### Stored monthly summaries

The application can show **precomputed monthly totals** from the `monthly_summaries` table. Those rows are filled by a **scheduled job** (first day of the month, UTC) for the **previous** calendar month. Until that runs, the section may be empty or only partially filled.

---

## Session and security

- After **email and password** login or **single sign-on** completion, the application stores a **JSON Web Token** in the browser (`localStorage`) and sends it on API requests. The session model is the same for both login types.  
- **Password accounts:** do not share your password; choose a strong password for your account.  
- **Single sign-on accounts:** sign-in is delegated to Google, GitHub, GitLab, or Microsoft; use that provider’s account security settings (two-factor authentication, and so on) as appropriate.  
- On a shared computer, **sign out** when finished (this clears the token from this browser).  

---

## Where to go next

- **Installation, ports, and OAuth environment variables:** root `README.md`  
- **How the system is built (including single sign-on):** [ARCHITECTURE.md](./ARCHITECTURE.md)  
- **PM2 process manager:** [HOWTO_CONTROLLING_APPLICATIONS.md](./HOWTO_CONTROLLING_APPLICATIONS.md)
