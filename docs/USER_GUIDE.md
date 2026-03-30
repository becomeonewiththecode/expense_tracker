# Expense Tracker — User Guide

This guide describes what the Expense Tracker does and how to run and use it day to day.

## What it is

Expense Tracker is a web application for **recording expenses** and **viewing spending by time period**. Each user has a private account: your expenses are not visible to other users.

You can:

- **Register** and **sign in** with **email and password**, or use **Google (Gmail), GitHub, GitLab, or Microsoft 365** when the server administrator has configured **OAuth** for those providers  
- **Add expenses** with amount, **transaction date**, category, how often the cost occurs, how you paid, **State** (**Active** or **Cancel**), and an optional note (recurring metadata is derived from the transaction date)  
- **Import** a **comma-separated values or PDF** statement, **review** each line, set **categories** (and adjust **frequency** if needed), then commit the import (see below); use category **Renewal** plus a **renewal type** for long-cycle renewals (see [Renewals screen](#renewals-screen))  
- Open **Renewals** in the header to work with renewal-tagged expenses only (annual fees, domains, policies, and similar)  
- Open **Prescriptions** to track medical, dental, vision, supplements, and equipment on **irregular renewal cycles** (**1–11 months** in monthly steps, or **1–5 years**), with **next renewal date** reminders in the app  
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

### Production on one machine (Docker Compose)

For a **built** client, API, PostgreSQL, and Redis in containers (nginx serves **`dist/`** and proxies **`/api`** and **`/health`** to the API):

1. From the **repository root**, run **`npm run compose:prod`**. It runs **`node deployment/docker-compose/ensure-env.mjs`**, which creates **`deployment/docker-compose/.env`** from **`.env.example`** if needed and fills a random **`JWT_SECRET`** when the line is empty or too short (written on your machine, gitignored—**keep the same file** across rebuilds so sessions and **Continue session** keep working).  
2. Edit **`deployment/docker-compose/.env`**: set **`CLIENT_ORIGIN`** to the URL users open (for example `http://localhost:8080` if **`HTTP_PORT=8080`**). Adjust **`HTTP_PORT`**, **`POSTGRES_PASSWORD`**, and optional **`OAUTH_*`** as needed. To set **`JWT_SECRET`** yourself instead, use `openssl rand -base64 32` before the first `up`.  
3. **Manual Compose** (without npm): run **`node deployment/docker-compose/ensure-env.mjs`**, then **`docker compose -f deployment/docker-compose/docker-compose.yml --env-file deployment/docker-compose/.env up -d --build`** (details in [deployment/docker-compose/README.md](../deployment/docker-compose/README.md)). The **api** service loads that **`.env`** via **`env_file`** so secrets are not wiped by empty Compose substitution.

Verify with **`curl -sS http://localhost:8080/health`** (adjust the port if you changed **`HTTP_PORT`**). OAuth redirect URIs must use the same origin as **`CLIENT_ORIGIN`**, for example `http://localhost:8080/api/auth/oauth/google/callback`.

---

## Account: register and sign in

1. Open the application URL in your browser.  
2. Choose **Create account** (or open the `/register` route).  
3. Enter **email** and **password** (minimum length is enforced on the form).  
4. After success you are signed in and taken to **Expenses** if you already have saved expenses, otherwise to **Import** (add or import).  

To sign in later, use **Sign in** and open the `/login` route with the same email and password.

**Forgot your password?** If you previously generated a **recovery code** under **Profile**, use **Forgot password?** on the sign-in page (`/recover`). Paste the full code and choose a new password. **No email is sent.** Afterward, sign in with your **email** and the **new** password. If you use **single sign-on only** and have not set a password, sign in with your provider first, then open **Profile** to add a password and optionally create a recovery code.

### Sign in with Google, GitHub, GitLab, or Microsoft

If your deployment has **OAuth** configured on the API, the **Sign in** and **Create account** screens show buttons for those providers. Choosing one sends you to that company’s site to approve access; you are then redirected back to the application at the `/oauth/callback` route and signed in with a normal session.

**Self-hosted setup:** In each provider’s developer console, register an OAuth application whose **redirect URI** is exactly this pattern, with no extra path segments:

`{your application origin}/api/auth/oauth/{provider}/callback`

Replace `{provider}` with `google`, `github`, `gitlab`, or `microsoft` depending on which console you are editing.

For example, with `CLIENT_ORIGIN=http://localhost:5173` and Google, the redirect URL is `http://localhost:5173/api/auth/oauth/google/callback`. The Vite development server proxies `/api` to the Node API, so this URL still reaches the backend. With **Docker Compose** production and `CLIENT_ORIGIN=http://localhost:8080`, the same pattern applies on port **8080** (nginx proxies `/api` to the API container). Set the `OAUTH_*` variables in `server/.env` (development) or in **`deployment/docker-compose/.env`** (Compose) as described in the example env files.

If you already registered with **email and password**, signing in with single sign-on using the **same email** links to the same account when the provider returns that email address.

**Sign out** clears your session in the browser (you will need to sign in again to use **Import** and **Reports**). If your **JSON Web Token** has expired but is still within the server’s refresh window, you may be offered **Continue session** instead of only seeing errors—see [Session and security](#session-and-security).

---

## Import screen

The **Import** page at `/expenses` is where you add and review individual transactions.

- **First-time users with no saved expenses:** you see the **manual add** form and **Import from statement** so you can enter data or upload a file. After you save at least one expense, the layout changes.  
- **When you already have expenses:** the **Import** page shows **Import from statement** and optional **Add expense manually** (expand the section). Open **Expenses** in the header (or the button on **Import**) to view, edit, and delete saved rows on a separate page. After your **first** saved expense (from the onboarding form) or after you **commit** an import that adds rows, you are taken to **Expenses** automatically.

### Add an expense

Fill in the form and click **Add expense**:

| Field | Description |
|--------|-------------|
| **Amount** | Dollar amount (must be zero or positive). |
| **Category** | One of: Home, Entertainment, Personal, Business, Education, Rent, Mortgage, Insurance, Subscription, **Renewal**. |
| **Renewal type** | Shown when **Category** is **Renewal** — required; pick the kind of renewal (for example domain names, car insurance, online education, HOA fees). The full list is in the app’s dropdowns and grows over time—see [RENEWALS.md](./RENEWALS.md). |
| **Website** | Shown when **Category** is **Renewal** — optional note, URL, or portal name. |
| **Frequency** | How often this cost applies: **Once**, **Weekly**, **Monthly**, **Bi-monthly**, or **Yearly**. For **Yearly**, enter the **annual** amount; for other recurring options, the amount is per week, per month, or per bi-monthly period as labeled. *(This field drives **Projection** run rates and labels; **Reports** bar charts still use each line’s transaction **date**.)* |
| **Financial institution** | Bank, VISA, Mastercard, or American Express. |
| **State** | **Active** (default) or **Cancel**. Use **Cancel** when you do not expect another charge for that subscription or recurring line; it still appears in **Upcoming renewals** (with a **green** row) so you can see the next theoretical renewal date until you dismiss the reminder or change the expense. **Subtotals** and **Total (all institutions)** in that panel sum **Active** rows only—**Cancel** amounts are not included. |
| **Transaction date** | The **spent** date for this line item. The server stores **day-of-month** and **calendar-month** metadata derived from this date (for renewals, exports, and imports)—you do not enter them separately. |
| **Note** | Optional free text. |

On the **Expenses** page (`/expenses/list`), you can **add an expense manually** (same fields as on **Import**) when you have no saved rows at all, or expand **Add expense manually** when you already have rows. The table lists **non-renewal** expenses only: rows with category **Renewal** live on the **Renewals** screen (if you change a row’s category to **Renewal** and save, it disappears from this table and shows under **Renewals**). If you only have renewal items, you see a note with a link to **Renewals** above an empty table. **Click a column heading** to sort by that column (click again to reverse direction). **Renewal type** and **Website** columns appear while you are **editing** a row and choose category **Renewal** (so you can set the type before saving). In **modification mode**, row **Edit** lets you change **transaction date**, amount, category, frequency, institution, **State**, and note (and renewal fields when the draft category is **Renewal**).

**Renewal reminders** (the **Upcoming renewals** banner): For recurring expenses (**Weekly**, **Monthly**, **Bi-monthly**, **Yearly**), the app estimates the next renewal from **frequency** and **transaction date** (day and month of year come from that date). While you are signed in, an **Upcoming renewals** panel may appear at the top of the main content on **Import**, **Expenses**, **Reports**, and on **Profile** (open **Profile** from the avatar **account menu**), when the next renewal is **25–40**, **15–24**, or **0–14** whole calendar days away (roughly a month, a couple of weeks, or the final two weeks—the wording may say “about 30 days,” “about 15 days,” or an exact count such as “in 12 days”). Reminders are **grouped by financial institution** (Bank, VISA, and so on): each group has its own **sortable** table (expense, transaction date, amount, **State**, renewal date), a **Subtotal** for that institution (**Active** rows only), and a **Total (all institutions)** line at the bottom (also **Active** only—the same per-line amounts as on your expense list, excluding **Cancel** from the sums). Lines marked **Cancel** in **State** are shown with a **green** background so you can spot subscriptions you have cancelled while still seeing the computed renewal date. After a renewal date has passed, a line is hidden for a short period until the next occurrence is nearer (the earliest &quot;about a month out&quot; window does not apply for about two weeks after that date, so the list does not immediately show the following cycle). **One-time** rows are ignored. Use **Dismiss** to hide a line for this browser session, or **Dismiss all** to hide every visible reminder. While any qualifying renewals exist, a **count** appears in an **amber badge** to the **right** of the avatar (**Me**); **click the badge** to **hide** or **show** the renewal tables and **Total (all institutions)** (click again to toggle). The **(i)** control next to **Upcoming renewals** toggles the long explanatory text (how bands, subtotals, and **Cancel** rows work). Renewal tables have **sortable column headings** (Expense, Transaction, Amount, State, Renews). If you dismiss **all** rows but qualifying renewals still exist, **click the badge** or open the **account menu** (avatar) and choose **Upcoming renewals** to show the panel again and clear those dismissals for this session. **Sign out** is in the same menu. The badge stays visible as you navigate between pages while renewals qualify (until you **sign out** or no rows qualify). Reminders are **in-app only**—not email or push notifications.

**Projection** in the table header opens a **combined** report: **daily**, **monthly**, and **yearly** run-rate totals across **all expenses shown in this table** (renewal-category rows are excluded here; on **Renewals**, combined projection counts **Active** renewal rows only—**Cancel** is excluded there too), plus a **pie chart** of annualized share by category (and a **One-time** slice when applicable). Click a slice to list the expenses in that segment; click the same slice again to clear. Each row also has **Projection** for **that expense only** (same numbers plus a single-slice or small pie); if you are editing a row, row **Projection** uses your unsaved values in the form. Click **Enter modification mode** to show **Edit** on each row; then **Edit**, **Save**, and **Cancel** work as before. Click **Exit modification mode** to go back to read-only rows (unsaved edits on the active row are cleared). **Delete** is always available. If you have no expenses yet, that page shows the manual form and a link to **Import** for import or additional entry.

### Import from a statement (comma-separated values or PDF)

Under **Import from statement**:

1. Set **financial institution** and **frequency** for the import. **Institution** applies to every row you commit.  
2. Choose a **.csv** or **.pdf** file and click **Upload and parse**.  
3. In **Review import**, pick a **category** for each row you want to keep. For **Renewal**, also choose a **renewal type** (required) and optionally fill **website**. Change **frequency** on a row if needed. Posted **date** on each line comes from the statement; saved expenses derive recurring metadata from that date. Rows left as **— Select category —**, or marked **Renewal** without a type, are **not** imported.  
4. Click **Add categorized rows to expenses**. Committed lines are saved with **State** **Active**; change **State** later under **Expenses** if a row is cancelled. **Discard import** deletes the staged batch without saving expenses.

Parsing uses **date, amount, and description** from the file; **comma-separated values** usually work best. **PDF** support is best-effort.

---

## Renewals screen

The **Renewals** tab (**`/renewals`**) lists only expenses whose **category** is **Renewal**—use it for items that renew on unusual schedules (often **Yearly** or longer horizons in practice). Each row has the same core fields as on **Expenses**, plus **Renewal type** and optional **Website**. **Projection** in the table header opens a **combined** report for **Active** renewal items only—rows with **State** **Cancel** are listed in the table but **not** included in the projection totals (same idea as **Upcoming renewals** subtotals). Individual rows do **not** have a **Projection** action (unlike the **Expenses** list).

- **Add renewal manually** (or the form when the list is empty) defaults to category **Renewal** and frequency **Yearly**; you must pick a **renewal type**.  
- **Import:** On **Import**, set a row’s category to **Renewal**, choose the **renewal type**, optionally add a **website**, then commit—those lines appear here; they do **not** appear in the main **Expenses** table (only on **Renewals**).  
- **Upcoming renewals** (amber badge and panel) is a **separate** feature: it highlights **recurring** expenses by date bands and is **not** limited to category **Renewal**. See the **Renewal reminders** paragraph under [Add an expense](#add-an-expense).

Technical detail: [RENEWALS.md](./RENEWALS.md).

---

## Prescriptions screen

The **Prescriptions** tab (**`/prescriptions`**) is for items that **do not** follow the same model as bank-card **expenses**: you set a **renewal period** (**1–11 months** in monthly steps, then **1–5 years**), a **next renewal date**, and optional **vendor** and **notes**. **Categories** are **Medical**, **Dental**, **Vision**, **Supplements**, and **Equipment**. **State** works like expenses (**Active** / **Cancel**); cancelled lines stay in the list but **do not** appear in the reminder banner.

- **Add prescription** — Fill **name**, **amount**, **category**, **renewal period**, **next renewal date**, **vendor**, **notes**, and **state**, then save.  
- **Edit** / **Delete** — Use the row actions.  
- **Renewed** — After a refill or visit, click **Renewed** to move **next renewal date** forward by one **renewal period** (you can still edit the date manually).  
- **Reminders** — When an **active** item is due within about **30 days**, or is **1–14 days overdue**, a **cyan** **Prescription renewals** panel appears **above the page** (on Import, Expenses, Renewals, Prescriptions, Reports, Profile). It is **in-app only** (not email). Use **Dismiss for this visit** to hide it until you reload or change prescriptions. Saving on this page updates the banner for the same session.

Technical detail: [PRESCRIPTIONS.md](./PRESCRIPTIONS.md).

---

## Reports screen

The **Reports** page shows **charts** of spending for different periods. The same **Upcoming renewals** and **Prescription renewals** panels (when applicable) appear above the report content as on other main screens.

Use the tabs:

- **Daily** — pick a date; total and (if applicable) category breakdown.  
- **Weekly** — current week (Monday through Sunday in UTC-based logic) or adjust via the API; the default user interface uses the server’s current week.  
- **Monthly** — pick year and month.  
- **Yearly** — totals by month for a year.  
- **Custom range** — start and end dates.  

Each view shows a **bar chart** (Recharts library) and a **total** for the period. **Click the trend chart** (or focus it and press Enter or Space) to open the same **Projection** modal as on **Expenses** — combined daily, monthly, and yearly run rates, pie chart, and slice drill-down — using your **saved expenses** (up to 500 rows). **Projection** annualizes recurring amounts from **frequency** (for example weekly × 52, monthly × 12, bi-monthly × 6, yearly × 1; **Once** counts only toward one-time totals). The bar chart reflects the **selected report period**; the projection is always **all saved expenses**, not filtered to that period.

### Stored monthly summaries

The application can show **precomputed monthly totals** from the `monthly_summaries` table. Those rows are filled by a **scheduled job** (first day of the month, UTC) for the **previous** calendar month. Until that runs, the section may be empty or only partially filled.

---

## Profile

The header shows **Import**, **Expenses**, **Renewals**, **Prescriptions**, and **Reports** as the main navigation; there is no separate **Profile** tab. Signed-in users open **Profile** from the **account menu** (click the avatar in the header) to update **email**, **password**, and **profile picture**. **Recovery code** (under **Password recovery**): generate a code once, store it safely offline, and use it on **`/recover`** if you forget your password. The **full code is shown only at the moment you create or replace it**; afterward, Profile shows a **masked placeholder** so you can see that a code is on file without seeing the secret. Replacing or removing the code invalidates the previous one.

**Backup and restore:** Download a **JSON** file of all expenses (`expense-tracker-backup` format). The file includes an **`account`** object (**`userId`**, **`email`**, and a human-readable **`label`**) so you can see which user the backup belongs to—downloads also use the email in the **filename**. **`account.hasRecoveryCode`** indicates whether a recovery code is on file; **`account.recoveryCode`** may contain the actual code (so you can restore password recovery after moving servers). Codes created before the server stored an exportable copy will show **`hasRecoveryCode`** without **`recoveryCode`** until you **replace** the code once. The top-level **`email`** field is still present for compatibility. Each expense object includes **`spent_at`**, **`frequency`**, **`state`** (`active` or `cancel`), category, institution, amount, description, optional **`website`** and **`renewal_kind`** when applicable, and denormalized **`payment_day`** / **`payment_month`** (derived from **`spent_at`** on save and restore). Older backup files without **`state`** still restore successfully (**Active** is assumed). **Restore** loads data into the **currently signed-in** account. If the backup’s email does not match your session, the app asks you to confirm before importing; the API can also reject a cross-account restore unless you confirm. **Append** adds imported rows to existing data; **Replace** deletes all current expenses first, then imports the file (use with care). Each restore is limited to **25,000** expense rows and a **15 MB** request body. Store backup files securely. If **Download backup** or **Restore** reports **Invalid token**, try **Continue session** if a prompt appears; otherwise **sign out** and **sign in** again (or the server’s signing secret may have changed).

---

## Session and security

- After **email and password** login or **single sign-on** completion, the application stores a **JSON Web Token** in the browser (`localStorage`) and sends it on API requests. The session model is the same for both login types. Tokens **expire** after a period configured on the server; when an API call fails because the token is no longer valid, you may see a prompt asking whether to **continue the session**. Choosing **Continue session** requests a **new token** without leaving the page (if your old token is still within the allowed refresh window **and** the server still uses the same **`JWT_SECRET`** that signed it). For **Docker Compose**, **`npm run compose:prod`** seeds **`JWT_SECRET`** into **`deployment/docker-compose/.env`** when missing; do not delete that file between rebuilds unless you intend to invalidate sessions. If you **rotate** the secret or **Continue session** returns **Invalid token**, **sign out** and sign in again.  
- **Password accounts:** do not share your password; choose a strong password for your account.  
- **Single sign-on accounts:** sign-in is delegated to Google, GitHub, GitLab, or Microsoft; use that provider’s account security settings (two-factor authentication, and so on) as appropriate.  
- On a shared computer, **sign out** when finished (this clears the token from this browser).  
- **Recovery codes** are as sensitive as passwords; anyone with the code can reset your password on **`/recover`** until the code is used or removed. **Backup JSON** may include **`account.recoveryCode`** when you download after generating or replacing the code—treat those files like a password vault.

---

## Where to go next

- **Installation, ports, OAuth, and production Compose:** root `README.md` and [deployment/docker-compose/README.md](../deployment/docker-compose/README.md)  
- **Renewals feature (API, import, data model):** [RENEWALS.md](./RENEWALS.md)  
- **Prescriptions feature (API, reminders, data model):** [PRESCRIPTIONS.md](./PRESCRIPTIONS.md)  
- **How the system is built (including single sign-on and recovery):** [ARCHITECTURE.md](./ARCHITECTURE.md)  
- **PM2 process manager:** [HOWTO_CONTROLLING_APPLICATIONS.md](./HOWTO_CONTROLLING_APPLICATIONS.md)  
- **Deployment index (Compose and Kubernetes):** [deployment/README.md](../deployment/README.md)
