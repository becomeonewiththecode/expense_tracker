# Expense Tracker — User Guide

This guide describes what the Expense Tracker does and how to run and use it day to day.

## What it is

Expense Tracker is a web application for **recording expenses** and **viewing spending by time period**. Each user has a private account: your expenses are not visible to other users.

You can:

- **Register** and **sign in** with email and password  
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
| **PostgreSQL** | Stores users and expenses |
| **Redis** (optional but recommended) | Caches report responses for faster repeats |
| **Node API** (`server/`) | REST backend and auth |

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
4. After success you are signed in and taken to **Expenses**.  

To sign in later, use **Sign in** (`/login`) with the same email and password.

**Sign out** clears your session in the browser (you will need to sign in again to use Expenses and Reports).

---

## Expenses screen

The **Expenses** page is where you add and review individual transactions.

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

The table lists your expenses (newest first). Click **Enter modification mode** to show **Edit** on each row; then **Edit** / **Save** / **Cancel** work as before. Click **Exit modification mode** to go back to read-only rows (unsaved edits on the active row are cleared). **Delete** is always available. 

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

Each view shows a **bar chart** (Recharts) and a **total** for the period.

### Stored monthly summaries

The app can show **precomputed monthly totals** from the `monthly_summaries` table. Those rows are filled by a **scheduled job** (first day of the month, UTC) for the **previous** calendar month. Until that runs, the section may be empty or only partially filled.

---

## Session and security (short)

- After login, the app stores a **JWT** in the browser and sends it on API requests.  
- Do not share your password.  
- On a shared computer, **sign out** when finished.  

---

## Where to go next

- **Installation and ports:** root `README.md`  
- **How the system is built:** [ARCHITECTURE.md](./ARCHITECTURE.md)
