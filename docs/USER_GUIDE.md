# Expense Tracker — User Guide

This guide describes what the Expense Tracker does and how to run and use it day to day.

## What it is

Expense Tracker is a web application for **recording expenses** and **viewing spending by time period**. Each user has a private account: your expenses are not visible to other users.

You can:

- **Register** and **sign in** with **email and password**, or use **Google (Gmail), GitHub, GitLab, or Microsoft 365** when the server administrator has configured **OAuth** for those providers  
- **Add expenses** with amount, **transaction date**, category, how often the cost occurs, how you paid, **State** (**Active**, **Paused**, or **Cancelled**), and an optional note (recurring metadata is derived from the transaction date)  
- **Import** a **comma-separated values or PDF** statement, **review** each line, set **categories** (and adjust **frequency** if needed), then commit the import (see below); use category **Renewal** plus a **renewal type** for long-cycle renewals (see [Renewals screen](#renewals-screen))  
- Open **Expenses** in the header (**`/expenses/list`**) and choose the **Renewals** tab to work with renewal-tagged expenses only (annual fees, domains, policies, and similar). Bookmark **`/renewals`** redirects to the same tab.  
- Open **Expenses** → **Prescriptions** to track medical, dental, vision, supplements, and equipment on **irregular renewal cycles** (**1–11 months** in monthly steps, or **1–5 years**), with **next renewal date** reminders in the app. **`/prescriptions`** redirects here.  
- Open **Expenses** → **Payment Plan** to track planned payments with category, schedule, priority, account, method, institution, tag, frequency, optional **# of payments** (remaining before paid off), amount, and notes; when **# of payments** hits **0**, the plan becomes **Cancelled (paid in full)** and is **hidden** from the table until you enable **Show cancelled (paid in full)**. **`/payment-plans`** redirects here.  
- **Delete** expenses from the list  
- Open **Income** in the header (**`/budget`**) for the **Budget & reports** hub: tabs **Import** (statements and manual adds—first in the tab bar), **Income** (paychecks and inflows—default when there is no **`?view=`**), **Savings** (named goals), **Budget** (monthly caps, cash flow, variance, alerts, CSV/PDF), and **Reports** (Daily … Custom, same as standalone **`/reports`**). Bookmarks **`/expenses`**, **`/income`**, and **`/savings`** redirect to **`/budget?view=import`**, **`/budget?view=income`**, and **`/budget?view=savings`**. Standalone **`/reports`** keeps its own page title; see [Budgeting](./BUDGETING.md)  
- Use the **Income** hub tab to add, edit, and delete income entries and to see the **recurring run-rate check** vs obligations; **monthly cash flow** appears on the **Budget** or **Reports** → **Monthly** views; details in [Income versus spend](./INCOME_VS_SPEND.md)  
- Open the **Savings** tab inside **`/budget`** (**`?view=savings`**) to track named goals with target amount, current balance, and optional target date. Bookmark **`/savings`** redirects to that view.  
- See **stored monthly summaries** (totals computed by a background job on a schedule)

The interface is **responsive**: it works on phones, tablets, and desktops.

**Signed-in header navigation:** The title **Expense Tracker** sits on the **first row** with the **notification bell** and **account menu** (avatar) on the right. **Income** (**`/budget`**) and **Expenses** (**`/expenses/list`**) are on the **second row** under the title. On viewports below Tailwind **`md`** (768px), that second row is **collapsed** behind a **menu** (hamburger) button to the left of the title; tap it to show or hide **Income** and **Expenses**. **Renewals**, **Prescriptions**, and **Payment Plan** live as **tabs** on the **Expenses** hub, not in the global header. **Import** and **Savings** are **tabs** inside **`/budget`**, not top-level header links. There is no top-level **Reports** link: open **`/reports`** directly or use the hub **Reports** tab.

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

For a **built** client, API, PostgreSQL, and Redis in containers (nginx serves **`dist/`** and proxies **`/api`** and **`/health`** to the API), there are **two** Compose files in **`deployment/docker-compose/`** (use **one** at a time; same container names):

- **`npm run compose:build`** — Builds **api** and **web** images from this repo (**`docker-compose-build.yml`**, **`up -d --build`**). Use for local testing of containerized builds.  
- **`npm run compose:prod`** — Pulls pre-built images (**`docker-compose-prod.yml`**, e.g. Docker Hub). Set **`IMAGE_TAG`** (and optional **`DOCKERHUB_USERNAME`**) in **`deployment/docker-compose/.env`** to match the tags you pushed. Run **`npm run compose:prod:pull`** before **`compose:prod`** when you want newer images.

Both commands run **`node deployment/docker-compose/ensure-env.mjs`** first, which creates **`deployment/docker-compose/.env`** from **`.env.example`** if needed and fills a random **`JWT_SECRET`** when the line is empty or too short (gitignored—**keep the same file** across rebuilds so sessions remain valid until normal expiry).

Edit **`deployment/docker-compose/.env`**: set **`CLIENT_ORIGIN`** to the URL users open (for example `http://localhost:8080` if **`HTTP_PORT=8080`**). Adjust **`HTTP_PORT`**, **`POSTGRES_PASSWORD`**, optional **`OAUTH_*`**, and (for prod images) **`IMAGE_TAG`**. To set **`JWT_SECRET`** yourself, use `openssl rand -base64 32` before the first `up`.

**Manual Compose:** run **`ensure-env.mjs`**, then **`docker compose -f deployment/docker-compose/docker-compose-build.yml`** or **`docker-compose-prod.yml`** with **`--env-file deployment/docker-compose/.env`** (see [deployment/docker-compose/README.md](../deployment/docker-compose/README.md)). The **api** service loads that **`.env`** via **`env_file`** so secrets are not wiped by empty Compose substitution.

Verify with **`curl -sS http://localhost:8080/health`** (adjust the port if you changed **`HTTP_PORT`**). OAuth redirect URIs must use the same origin as **`CLIENT_ORIGIN`**, for example `http://localhost:8080/api/auth/oauth/google/callback`.

---

## Account: register and sign in

1. Open the application URL in your browser.  
2. If you are signed out, the `/` route shows a public landing page with **Get started** and **Log in** actions. Choose **Create account** (or open the `/register` route directly).  
3. Enter **email** and **password** (minimum length is enforced on the form).  
4. After success you are signed in and taken to **Expenses** if you already have saved expenses, otherwise to the hub **Import** tab (**`/budget?view=import`**).  

To sign in later, use **Sign in** from the landing page or open `/login` directly with the same email and password.

### User two-factor authentication (2FA)

- Password sign-in now includes a second step with an authenticator app code.
- First password sign-in for an account without 2FA opens **2FA setup** with a QR code and manual key, then you enter the 6-digit code to activate.
- After setup, future password sign-ins require **Verify and sign in** with the current 6-digit code.
- If the 2FA setup or verify challenge expires, start sign-in again.

**Forgot your password?** If you previously generated a **recovery code** under **Profile**, use **Forgot password?** on the sign-in page (`/recover`). Paste the full code and choose a new password. **No email is sent.** Afterward, sign in with your **email** and the **new** password. If you use **single sign-on only** and have not set a password, sign in with your provider first, then open **Profile** to add a password and optionally create a recovery code.

### Sign in with Google, GitHub, GitLab, or Microsoft

If your deployment has **OAuth** configured on the API, the **Sign in** and **Create account** screens show buttons for those providers. Choosing one sends you to that company’s site to approve access; you are then redirected back to the application at the **`/oauth/callback`** route, which completes sign-in using a short-lived **login code** (the session token is not carried in the URL). You end up signed in with the same kind of session as email-and-password users.

**Self-hosted setup:** In each provider’s developer console, register an OAuth application whose **redirect URI** is exactly this pattern, with no extra path segments:

`{your application origin}/api/auth/oauth/{provider}/callback`

Replace `{provider}` with `google`, `github`, `gitlab`, or `microsoft` depending on which console you are editing.

For example, with `CLIENT_ORIGIN=http://localhost:5173` and Google, the redirect URL is `http://localhost:5173/api/auth/oauth/google/callback`. The Vite development server proxies `/api` to the Node API, so this URL still reaches the backend. With **Docker Compose** production and `CLIENT_ORIGIN=http://localhost:8080`, the same pattern applies on port **8080** (nginx proxies `/api` to the API container). Set the `OAUTH_*` variables in `server/.env` (development) or in **`deployment/docker-compose/.env`** (Compose) as described in the example env files.

If you already registered with **email and password**, signing in with single sign-on using the **same email** links to the same account when the provider returns that email address.

**Sign out** clears your session in the browser (you will need to sign in again to use the hub, **Import**, and the list screens).

---

## Import (hub tab)

Open **Income** in the header, then choose the **Import** tab—the **first** tab in the **Budget & reports** bar (**`/budget?view=import`**). The same screen (**`ExpensesPage`**) handles adds and statement import. Typing **`/expenses`** redirects here.

- **First-time users with no saved expenses:** you see the **manual add** form and **Import from statement** (expand **Show** if sections are collapsed). After you save at least one expense, the layout changes.  
- **When you already have expenses:** **Import from statement** and **Add expense manually** use **Show** / **Hide**; with a staged batch loaded, those sections stay available for review. Long import help text is behind a circular **i** control. Open **Expenses** from the header (second row or hamburger menu), or use the **Expenses** button on this tab. After your **first** saved expense or after you **commit** an import that adds rows, you are taken to **Expenses** automatically.

### Add an expense

Fill in the form and click **Add expense**:

| Field | Description |
|--------|-------------|
| **Amount** | Dollar amount (must be zero or positive). |
| **Category** | One of: Home, Entertainment, Personal, Business, Education, Rent, Mortgage, Insurance, Subscription, **Renewal**, **Payment Plan**. |
| **Renewal type** | Shown when **Category** is **Renewal** — required; pick the kind of renewal (for example domain names, car insurance, online education, HOA fees). The full list is in the app’s dropdowns and grows over time—see [RENEWALS.md](./RENEWALS.md). |
| **Website** | Shown when **Category** is **Renewal** — optional note, URL, or portal name. |
| **Frequency** | How often this cost applies: **Once**, **Weekly**, **Monthly**, **Bi-monthly**, or **Yearly**. For **Yearly**, enter the **annual** amount; for other recurring options, the amount is per week, per month, or per bi-monthly period as labeled. *(This field drives **Projection** run rates and labels; **Budget** / **Reports** bar charts still use each line’s transaction **date**.)* |
| **Financial institution** | **Bank**, **VISA**, **Mastercard**, or **American Express**. |
| **Bank** | Shown only when **Financial institution** is **Bank**. Choose your institution: **CIBC**, **RBC**, **Scotiabank**, **TD**, **BMO**, **Simplii Financial**, **EQ Bank**, **Tangerine**, or **Not listed** (stored as a slug such as **`cibc`** or **`not_listed`**; required on **create** when institution is **Bank**). |
| **State** | **Active** (default), **Paused**, or **Cancelled**. Use **Cancelled** when you do not expect another charge for that subscription or recurring line; it still appears in **Upcoming expenses** (with a **green** row) so you can see the next theoretical renewal date until you dismiss the reminder or change the expense. **Subtotals** and **Total (all institutions)** in that panel sum **Active** rows only—**Cancelled** and **Paused** amounts are not included. |
| **Transaction date** | The **spent** date for this line item. The server stores **day-of-month** and **calendar-month** metadata derived from this date (for renewals, exports, and imports)—you do not enter them separately. |
| **Note** | Optional free text. |

### Expenses page (`/expenses/list`)

#### Adding and viewing expenses

- When you have **no saved rows**, the manual add form is shown directly.
- When you **already have rows**, expand **Add expense manually** to reveal the form.
- The table lists expenses whose category is **not** Renewal and **not** Payment Plan.
  - **Renewal** rows live on the [Renewals screen](#renewals-screen).
  - **Payment Plan** rows live on the [Payment Plan screen](#payment-plan-screen).
  - Changing a row to either category and saving moves it to that destination.
- If you only have renewal or payment-plan items, links to those screens appear above an empty table.

#### Sorting and searching

- **Click a column heading** to sort by that column; click again to reverse direction.
- **Search notes** in the table header filters rows by the Note text.

#### Editing a row

1. Open a row’s **Actions** menu and choose **Edit**.
2. A **dialog** opens with the **same fields as Add expense manually** (transaction date, amount, category, frequency, bi-monthly payment days when applicable, institution, **Bank** when institution is **Bank**, state, note—and when category is **Renewal**, **renewal type** and **website**).
3. **Save changes** sends a **PATCH**; **Close**, **Cancel**, **Escape**, or clicking the dimmed backdrop discards edits.
4. The table stays read-only; pagination changes close an open edit dialog.
5. After a successful save or add, the table header briefly flashes an update icon as confirmation.

---

### Renewal reminders (Upcoming expenses banner)

For recurring expenses (Weekly, Monthly, Bi-monthly, Yearly), the app estimates the next renewal from the expense’s **frequency** and **transaction date**.

#### When reminders appear

The **Upcoming expenses** panel shows at the top of: the **Budget & reports** hub (**`/budget`** and all **`?view=`** tabs), the **Expenses** hub (**`/expenses/list`** and all its tabs), standalone **`/reports`**, and Profile.

By default, the panel shows items due within **7 days**. You can change this with **Showing renewals within** in the panel header (next to **Show/Hide**) or in **Profile** → **Appearance** → **Upcoming renewals window (days)**. Choose **1**, **3**, **5**, **7**, **10**, **14**, **21**, **30**, or **40** days.

| Days until renewal | Reminder tier | Wording example |
|---|---|---|
| **0 -- 14** | Final two weeks | Exact count, e.g. “in 12 days” |
| **15 -- 24** | About two weeks | “about 15 days” |
| **25 -- 40** | About a month | “about 30 days” |

The selected window acts as a cap on those tiers (for example, a 7-day window shows only rows due in 0-7 days even though tier logic is defined up to 40 days).

- **One-time** expenses are ignored.
- After a renewal date passes, the line is hidden for about two weeks so the list does not immediately show the next cycle.

#### How reminders are organized

- Reminders are **grouped by financial institution** (for **Bank**, the label includes the chosen bank, e.g. **Bank — RBC** or **Bank — Not listed**; card types stay **VISA**, etc.).
- Each group has a **sortable table** with columns: Expense, Transaction, Amount, State, Renews.
- A **Subtotal** per institution sums **Active** rows only.
- A **Total (all institutions)** line at the bottom also sums Active rows only (Cancelled and Paused amounts are excluded).
- Payment Plan rows show an **info glyph (i)** on the amount that reveals the row frequency on hover/focus.

#### Cancelled rows

Lines marked **Cancelled** in State are shown with a **green background** so you can spot subscriptions you have cancelled while still seeing the computed renewal date.

After a cancelled row is **at least one day past** its renewal date (and still within your selected window horizon), it is **removed from Upcoming expenses** and listed under **Profile** → **Appearance** → **Auto-hidden cancelled recurring items** (browser storage per account). That list applies to cancelled recurring **expenses**, **renewals**, and **payment-plan** rows the same way.

#### Expanding, collapsing, and dismissing

- Reminder tables start **collapsed**. Expand or collapse them with:
  - The **amber badge** next to the avatar
  - The panel’s **Show/Hide** control
  - **Double-clicking** the title row
- Set **Showing renewals within** in the panel header to change how many upcoming days are displayed.
- **Dismiss** hides a single line for this browser session.
- **Dismiss all** hides every visible reminder.
- If you dismiss all rows but qualifying renewals still exist, click the **amber badge** or open the **account menu** (avatar) and choose **Upcoming expenses** to restore them.

#### Amber badge

- While any qualifying renewals exist, a **count** appears in an **amber badge** to the right of the avatar.
- The number **matches how many rows you see** in the reminder tables when at least one row is shown. If you **Dismiss** some lines in this session, the badge reflects **only the rows still visible**. If you **Dismiss all** while rows still qualify, the badge shows **how many still qualify** until you expand again from the badge or **Upcoming expenses** in the account menu.
- **Click the badge** to toggle the reminder tables and total on or off.
- The badge stays visible as you navigate between pages until you sign out or no rows qualify.
- The **(i)** control next to “Upcoming expenses” toggles a detailed explanation of how bands, subtotals, and Cancelled rows work.

Reminders are **in-app only** -- not email or push notifications.

---

### Projection

#### Combined projection

Click **Projection** in the table header to see a combined report:

- **Daily**, **monthly**, and **yearly** run-rate totals across all expenses shown in the table.
- A **pie chart** of annualized share by category (with a **One-time** slice when applicable).
- Click a pie slice to list the expenses in that segment; click the same slice again to clear.

> On the Expenses page, renewal-category rows are excluded. On Renewals, combined projection counts **Active** rows only (Cancelled and Paused are excluded).

#### Per-row projection

- Each row’s **Actions** menu includes **Projection** for that expense only (same numbers, single slice or small pie).

#### Other actions

- **Edit** opens the full-field edit dialog (see [Editing a row](#editing-a-row)).
- **Delete** asks for confirmation.
- If you have no expenses yet, the page shows the manual form and a link to the hub **Import** tab (**`/budget?view=import`**).

### Import from a statement (comma-separated values or PDF)

Under **Import from statement**:

1. Set **financial institution** and **frequency** for the import. **Institution** applies to every row you commit.  
2. Choose a **.csv** or **.pdf** file and click **Upload and parse**.  
3. In **Review import**, pick a **category** for each row you want to keep. For **Renewal**, also choose a **renewal type** (required) and optionally fill **website**. Change **frequency** on a row if needed. Posted **date** on each line comes from the statement; saved expenses derive recurring metadata from that date. Rows left as **— Select category —**, or marked **Renewal** without a type, are **not** imported.  
4. Click **Add categorized rows to expenses**. Committed lines are saved with **State** **Active**; change **State** later under **Expenses** if a row is cancelled. **Discard import** deletes the staged batch without saving expenses.

Parsing uses **date, amount, and description** from the file; **comma-separated values** usually work best. **PDF** support is best-effort.

---

## Renewals screen

**Expenses** → **Renewals** (**`/expenses/list?view=renewals`**; **`/renewals`** redirects) lists only expenses whose **category** is **Renewal**—use it for items that renew on unusual schedules (often **Yearly** or longer horizons in practice). Each row has the same core fields as on **Expenses**, plus **Renewal type** and optional **Website**. **Edit** opens the same **dialog** as on **Expenses** (full manual-expense field set, pre-filled). **Projection** in the table header opens a **combined** report for **Active** renewal items only—rows with **State** **Cancelled** or **Paused** are listed in the table but **not** included in the combined projection totals (same idea as **Upcoming expenses** subtotals). The row **Actions** menu also includes **Projection** for that row (and **Edit** / **Delete**). The **Actions** column stays visible when you scroll horizontally (sticky on the right), like the other list tables. Successful saves/adds briefly flash an update icon in the renewal table header.

- **Add renewal manually** (or the form when the list is empty) defaults to category **Renewal** and frequency **Yearly**; you must pick a **renewal type**.  
- **Import:** On the hub **Import** tab, set a row’s category to **Renewal**, choose the **renewal type**, optionally add a **website**, then commit—those lines appear here; they do **not** appear in the main **Expenses** table (only on **Renewals**).  
- **Upcoming expenses** (amber badge and panel) is a **separate** feature: it highlights **recurring** expenses by date bands and is **not** limited to category **Renewal**. See the **Renewal reminders** paragraph under [Add an expense](#add-an-expense).

---

## Payment Plan screen

**Expenses** → **Payment Plan** (**`/expenses/list?view=payment-plans`**; **`/payment-plans`** redirects) tracks planned payments in a dedicated table with fields such as category, schedule, priority, status, account type, payment method, institution, tag, frequency, optional **# of payments** (remaining count before the plan is paid off; leave blank for ongoing), amount, and notes.

- **Paid in full** — When **# of payments** reaches **0**, the plan is marked **Cancelled (paid in full)** and is **hidden** from the table by default. Turn on **Show cancelled (paid in full)** in the table header to list or edit those rows. Combined **Projection** only includes plans that are currently visible in the table.

- **Edit** — **Actions** → **Edit** opens a full-screen-style dialog with the **same fields as Add payment plan** (name, amount, category, schedule, priority, status including **Cancelled (paid in full)** when applicable, account, method, institution, tag, frequency, **# of payments**, notes). **Save changes** sends a **PATCH**; **Close**, **Cancel**, **Escape**, or clicking the dimmed backdrop discards edits.

- **Add payment plan** — The header card has **Show** / **Hide** for the inline add form. The form starts **closed**; open **Show** to add a plan. After the **first** time the list becomes non-empty (load or save), the section **collapses** again if it was open—you can **Show** anytime to add another.
- **Edit** / **Delete** — Open the row **Actions** menu.
- **Credit card account type** — Choosing **Credit Card** switches institution selection to a credit-card subtype list (**VISA**, **American Express**, **Mastercard**).
- **Note search** — Use **Search notes** in the table header to filter rows by the **Notes** field.
- **Update indicator** — After successful add/edit saves, a short header flash icon confirms the Payment Plan table was updated.
- **Expense category integration** — If an expense row uses category **Payment Plan**, it is synced into this page and removed from the main **Expenses** table view.

Technical detail: [PAYMENT_PLANS.md](./PAYMENT_PLANS.md).

---

## Prescriptions screen

**Expenses** → **Prescriptions** (**`/expenses/list?view=prescriptions`**; **`/prescriptions`** redirects) is for items that **do not** follow the same model as bank-card **expenses**: you set a **renewal period** (**1–11 months** in monthly steps, then **1–5 years**), a **next renewal date**, and optional **vendor** and **notes**. **Categories** are **Medical**, **Dental**, **Vision**, **Supplements**, and **Equipment**. **State** works like expenses (**Active** / **Paused** / **Cancelled**); non-**active** lines stay in the list but **do not** appear in the reminder banner.

- **Add prescription** — The form is behind **Show** / **Hide** (starts **collapsed**). Fill **name**, **amount**, **category**, **renewal period**, **next renewal date**, **vendor**, **notes**, and **state**, then save.  
- **Edit** — **Actions** → **Edit** opens a **dialog** with the **same fields as Add prescription**, pre-filled; **Save changes**, **Close** / **Cancel** / **Escape** / backdrop work like other list edit dialogs.  
- **Delete** — Open the row **Actions** menu.  
- **Renewed** — After a refill or visit, click **Renewed** to move **next renewal date** forward by one **renewal period** (you can still edit the date manually).  
- **Update indicator** — Successful add/edit/renew updates flash a brief icon in the table header so you can confirm the Prescriptions table changed.
- **Reminders** — When an **active** item is due within about **30 days**, or is **1–14 days overdue**, a **cyan** **Prescription renewals** panel appears **above the page** (on **`/budget`** and all hub tabs, the **Expenses** hub and its tabs, **`/reports`**, **Profile**). It is **in-app only** (not email). Use **Dismiss for this visit** to hide it until you reload or change prescriptions. Saving on this page updates the banner for the same session.

Technical detail: [PRESCRIPTIONS.md](./PRESCRIPTIONS.md).

---

## Savings goals screen

Open **Income** in the header, then the **Savings** tab on **`/budget`** (**`?view=savings`**; bookmark **`/savings`** redirects). The page lists savings goals with **name**, **target** amount, **current** balance, and optional **target date**. Add goals from the form at the top; **Edit** and **Delete** use the row actions. Amounts are stored and shown in dollars.

---

## Budget and reports

**Primary path:** Open **Income** in the header (**`/budget`** — the nav label is **Income**, the page title remains **Budget & reports**). Tabs (left to right):

- **Import** — statement upload, category rules, staging (same as bookmark **`/expenses`**). URL: **`?view=import`**.  
- **Income** (default when there is no **`?view=`**) — logged paychecks and inflows; recurring run-rate banner; **Add entry** starts **collapsed** (**Show** / **Hide**). URL: **`?view=income`** or omit **`view`**.  
- **Savings** — named savings goals. URL: **`?view=savings`**.  
- **Budget** — monthly picker, **cash flow** card, **budget** editor (**Show** / **Hide** for the **Monthly budget** block), variance, chart, CSV/PDF (see [Budgeting](./BUDGETING.md)). URL: **`?view=budget`**.  
- **Reports** — **Daily** … **Custom** like standalone **`/reports`**; URL: **`?view=reports`**.

**Standalone Reports:** Open **`/reports`**. You get the full **Reports** page with its own heading and **← Budget & reports home** link. Period tabs and **`?tab=`** match the hub **Reports** tab.

On all of these routes, the same **Upcoming expenses** and **Prescription renewals** panels (when applicable) appear above the content as on other main screens.

### Period tabs (Reports tab or `/reports`)

- **Daily** — pick a date; total and (if applicable) category breakdown.  
- **Weekly** — current week (Monday through Sunday in UTC-based logic) or adjust via the API; the default user interface uses the server’s current week.  
- **Monthly** — pick year and month.  
- **Yearly** — totals by month for a year.  
- **Custom range** — start and end dates.  

Each view shows a **bar chart** (Recharts library) and a **total** for the period. **Click the trend chart** (or focus it and press Enter or Space) to open the same **Projection** modal as on **Expenses** — combined daily, monthly, and yearly run rates, pie chart, and slice drill-down — using your **saved expenses** (up to 500 rows). **Projection** annualizes recurring amounts from **frequency** (for example weekly × 52, monthly × 12, bi-monthly × 24 since it is paid twice per month, yearly × 1; **Once** counts only toward one-time totals). The bar chart reflects the **selected report period**; the projection is always **all saved expenses**, not filtered to that period.

### Stored monthly summaries

The application can show **precomputed monthly totals** from the `monthly_summaries` table. Those rows are filled by a **scheduled job** (first day of the month, UTC) for the **previous** calendar month. Until that runs, the section may be empty or only partially filled.

---

## Profile

The shell header uses two rows: **Expense Tracker** with the **notification bell** and **account menu** on the first row, and **Income** (**`/budget`**) plus **Expenses** (**`/expenses/list`**) on the second row (behind a **hamburger** menu below the **`md`** breakpoint). **Savings**, **Import**, **Budget**, and **Reports** are **tabs** inside **`/budget`**, not separate header links. **Renewals**, **Prescriptions**, and **Payment Plan** are **tabs** on **`/expenses/list`**. There is no separate **Profile** tab. Open **Profile** from the **account menu** (avatar): **email**, **password**, **profile picture**; **Upcoming expenses** when applicable; **Sign out**. **Theme** is **Profile** → **Appearance**.

**Recovery code** (under **Password recovery**): generate a code once, store it safely offline, and use it on **`/recover`** if you forget your password. The **full code is shown only at the moment you create or replace it**; afterward, Profile shows a **masked placeholder** so you can see that a code is on file without seeing the secret. Replacing or removing the code invalidates the previous one.

**Table display:** The **Expenses**, **Renewals**, **Prescriptions**, and **Payment Plan** tabs on **`/expenses/list`** (legacy paths **`/renewals`**, **`/prescriptions`**, **`/payment-plans`** redirect into the same hub) paginate client-side. Default is **5 rows per page** for new sessions (a saved **localStorage** value can override). Options **5**, **10**, **25**, **50**, **100** — set in **Profile** or the table footer **Rows** selector.

**Upcoming renewals window:** The **Upcoming expenses** panel uses a saved day window (default **7** days). You can change it in **Profile** → **Appearance** or directly in the panel header via **Showing renewals within**. Supported values are **1**, **3**, **5**, **7**, **10**, **14**, **21**, **30**, and **40** days.

**Auto-hidden cancelled recurring items:** Under **Appearance**, a read-only list shows cancelled recurring expenses (including renewals and payment-plan-linked rows) that **Upcoming expenses** has auto-hidden after renewal—see the renewal reminders section above.

**Backup and restore:** Download a **JSON** file (`expense-tracker-backup` format). Current exports use **`version`** **`4`**, which includes **`expenses`**, **`prescriptions`**, **`paymentPlans`**, and **`incomeEntries`** (with matching **`…Count`** fields). Older **`version`** **`1`**–**`3`** files still restore. **Renewals** are normal **`expenses`** with **`category`** **`renewal`** inside the **`expenses`** array. Each expense includes **`state`**: **`active`**, **`paused`**, or **`cancelled`** (matching the database and the app UI—**re-download** after a server update if an old file showed every row as **`active`** when some were cancelled). Each prescription includes the same **`state`** values. The file includes an **`account`** object (**`userId`**, **`email`**, and a human-readable **`label`**) so you can see which user the backup belongs to—downloads also use the email in the **filename**. **`account.hasRecoveryCode`** indicates whether a recovery code is on file; **`account.recoveryCode`** may contain the actual code (so you can restore password recovery after moving servers). Codes created before the server stored an exportable copy will show **`hasRecoveryCode`** without **`recoveryCode`** until you **replace** the code once. The top-level **`email`** field is still present for compatibility. Each expense object includes **`spent_at`**, **`frequency`**, **`state`**, category, institution, amount, description, optional **`website`** and **`renewal_kind`** when applicable, and denormalized **`payment_day`** / **`payment_month`**. Older backup files without **`state`** still restore successfully (**active** is assumed). **Restore** loads into the **currently signed-in** account. If the backup’s email does not match your session, the app asks you to confirm before importing. **Append** adds imported rows. **Replace** clears and reloads from the file according to **`version`**: **`1`**—**expenses** only; **`2`**—**expenses** and **prescriptions**; **`3`**—also **payment plans**; **`4`**—also **income entries**. Each restore is limited to **25,000** rows per array and a **15 MB** request body. Store backup files securely. If **Download backup** or **Restore** reports an auth/session error, sign in again (or the server’s signing secret may have changed).

---

## Admin site (operators)

The application includes an **admin site** at **`/admin`** for operators. It is separate from normal user accounts and uses **admin credentials** plus **two-factor authentication**.

### First-time login and 2FA enrollment

1. Enter **`ADMIN_USERNAME`** and **`ADMIN_PASSWORD`** (set by the server operator in environment variables).
2. On first login, if 2FA has not been configured for that admin, the page shows a **QR code** to scan with an authenticator app. Scan it, then enter the 6-digit code to **Activate 2FA**.
3. After enrollment, future logins require the 6-digit code (**Verify 2FA**).

### Session timeout and re-authentication

- Admin sessions end after **15 minutes of inactivity**.
- Sensitive operations require **re-authentication** (admin password + 2FA) even within an active session.
- The **Session** tab always includes an admin password change form. On first login it is marked as required; after that it remains available for routine password rotation.

### Tabs and operations

- **System health:** Runs automatically and shows API health, **web UI reachability**, database connectivity, basic database sanity, and application resources.
- **Backup & restore:** Per-user and whole-database backups (JSON downloads), restore preview and restore apply.
- **User accounts:** View users, reset passwords, modify roles/permissions (requires re-authentication).
- **Swagger:** Embedded API documentation for all endpoints (backed by `/api/docs` and `/api/openapi.json`). To call protected routes from Swagger, use **Authorize** with the tokens described in [**API_AUTHORIZATION.md**](./API_AUTHORIZATION.md) (**user** vs **admin** JWT and optional **`x-admin-reauth`**).

---

## Session and security

- After **email and password** 2FA verification (or **single sign-on**) the API sets an **HttpOnly session cookie** (**`expense_tracker_session`**) used on API requests. If you run **production** over **plain HTTP** and the browser never stays signed in, check **`SESSION_COOKIE_SECURE`** and proxy **`X-Forwarded-Proto`** (see **[DEPLOYMENT.md](./DEPLOYMENT.md)** and **[API_AUTHORIZATION.md](./API_AUTHORIZATION.md)**).
- User sessions end after **15 minutes of inactivity**. When this happens, protected requests fail and the browser redirects to **`/login?expired=1`**.
- If the token signature is invalid (for example after rotating **`JWT_SECRET`**), the app also ends the browser session and sends you to sign in again.
- For **Docker Compose** (**`npm run compose:build`** or **`compose:prod`**), **`ensure-env.mjs`** seeds **`JWT_SECRET`** into **`deployment/docker-compose/.env`** when missing; keep that file stable across rebuilds unless you intentionally want to invalidate sessions.
- **Password accounts:** do not share your password; choose a strong password for your account.  
- **Single sign-on accounts:** sign-in is delegated to Google, GitHub, GitLab, or Microsoft; use that provider’s account security settings (two-factor authentication, and so on) as appropriate.  
- On a shared computer, **sign out** when finished (this clears the session cookie from this browser).
- **Recovery codes** are as sensitive as passwords; anyone with the code can reset your password on **`/recover`** until the code is used or removed. **Backup JSON** includes **`account.recoveryCode`** only when explicitly requested by export options—treat those files like a password vault.

---

## Where to go next

- **Swagger / OpenAPI tokens and re-authentication:** [API_AUTHORIZATION.md](./API_AUTHORIZATION.md)
- **Installation, ports, OAuth, and production Compose:** root `README.md` and [deployment/docker-compose/README.md](../deployment/docker-compose/README.md)  
- **Renewals feature (API, import, data model):** [RENEWALS.md](./RENEWALS.md)  
- **Payment plans feature (API, expense sync, add-section behavior):** [PAYMENT_PLANS.md](./PAYMENT_PLANS.md)  
- **Prescriptions feature (API, reminders, data model):** [PRESCRIPTIONS.md](./PRESCRIPTIONS.md)  
- **Budget hub, monthly budgets, and notifications:** [BUDGETING.md](./BUDGETING.md)  
- **How the system is built (including single sign-on and recovery):** [ARCHITECTURE.md](./ARCHITECTURE.md)  
- **PM2 process manager:** [HOWTO_CONTROLLING_APPLICATIONS.md](./HOWTO_CONTROLLING_APPLICATIONS.md)  
- **Deployment index (Compose and Kubernetes):** [deployment/README.md](../deployment/README.md)
