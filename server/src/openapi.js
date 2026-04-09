export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "Expense Tracker API",
    version: "1.0.0",
    description:
      "REST API for Expense Tracker. Most endpoints require a user JWT (**Authorization: Bearer**). Admin endpoints under **/api/admin** use a separate admin session token.\n\n" +
      "**Liveness:** **GET /health** is served at the **application root** (not under **/api**)—for example proxied by nginx beside **/api**. Response: **`{ ok: true, version: string }`** where **`version`** comes from **`APP_VERSION`** or **`server/package.json`**.\n\n" +
      "**User backup:** **GET /backup/export** (under this spec’s **/api** base) returns **`format: expense-tracker-backup`**, **`version: 4`** (current), including **`incomeEntries`** and **`incomeEntryCount`**. **POST /backup/restore** accepts file **`version`** **1**–**4**; **`replace`** clears **`income_entries`** only when the file is **version 4** or higher.\n\n" +
      "**Admin database backup** responses use **`format: expense-tracker-admin-db-backup`**, **`version: 2`** (includes **`incomeEntries`**). Per-user admin backup uses **`expense-tracker-admin-user-backup`**, **`version: 2`**.",
  },
  servers: [{ url: "/api" }],
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
      adminBearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
      adminReauth: { type: "apiKey", in: "header", name: "x-admin-reauth" },
    },
    schemas: {
      HealthResponse: {
        type: "object",
        required: ["ok", "version"],
        properties: {
          ok: { type: "boolean", example: true },
          version: { type: "string", description: "Release string (APP_VERSION or package version)", example: "1.0.0" },
        },
      },
      UserBackupExport: {
        type: "object",
        description:
          "Profile backup JSON. Current export **version** is **4**. Older files may omit **incomeEntries** (treat as absent for v1–v3).",
        required: ["format", "version", "exportedAt", "expenses"],
        properties: {
          format: { type: "string", enum: ["expense-tracker-backup"] },
          version: { type: "integer", enum: [1, 2, 3, 4], description: "Restore accepts 1–4; export emits 4" },
          exportedAt: { type: "string", format: "date-time" },
          email: { type: "string", nullable: true, description: "Legacy top-level; same as account.email when present" },
          account: {
            type: "object",
            properties: {
              userId: { type: "integer" },
              email: { type: "string", nullable: true },
              label: { type: "string" },
              hasRecoveryCode: { type: "boolean" },
              recoveryCode: { type: "string", description: "Present when export includes decryptable ciphertext" },
            },
          },
          expenseCount: { type: "integer" },
          renewalCount: { type: "integer" },
          expenses: { type: "array", items: { type: "object" } },
          prescriptionCount: { type: "integer", description: "v2+" },
          prescriptions: { type: "array", items: { type: "object" }, description: "v2+" },
          paymentPlanCount: { type: "integer", description: "v3+" },
          paymentPlans: { type: "array", items: { type: "object" }, description: "v3+" },
          incomeEntryCount: { type: "integer", description: "v4+" },
          incomeEntries: {
            type: "array",
            description: "v4+; items: amount, frequency, description, received_at, payment_day, payment_day_2 (bimonthly)",
            items: { type: "object" },
          },
        },
      },
      BackupRestoreRequest: {
        type: "object",
        description:
          "Same shape as an export file plus **mode**: **append** or **replace**. Optional **confirmCrossAccountRestore** when account email differs (409 without it).",
        required: ["format", "version", "expenses", "mode"],
        properties: {
          format: { type: "string", enum: ["expense-tracker-backup"] },
          version: { type: "integer", minimum: 1, maximum: 4 },
          mode: { type: "string", enum: ["append", "replace"] },
          confirmCrossAccountRestore: { type: "boolean" },
          expenses: { type: "array" },
          prescriptions: { type: "array", description: "Required as array when version >= 2 (may be [])" },
          paymentPlans: { type: "array", description: "Required as array when version >= 3 (may be [])" },
          incomeEntries: { type: "array", description: "Required as array when version >= 4 (may be [])" },
          account: { type: "object" },
        },
      },
    },
  },
  tags: [
    { name: "auth" },
    { name: "expenses" },
    { name: "imports" },
    { name: "reports" },
    { name: "budgets" },
    { name: "notifications" },
    { name: "income" },
    {
      name: "backup",
      description:
        "User JSON backup (Profile). Export **version 4** includes **expenses**, **prescriptions**, **paymentPlans**, **incomeEntries**, and **account**. Restore accepts **version** **1**–**4**; **replace** clears tables according to file version (income only for v4+).",
    },
    { name: "prescriptions" },
    { name: "payment-plans" },
    { name: "admin" },
  ],
  paths: {
    "/auth/register": { post: { tags: ["auth"], summary: "Register user" } },
    "/auth/login": { post: { tags: ["auth"], summary: "Login user (password) — returns challengeId" } },
    "/auth/verify-2fa": { post: { tags: ["auth"], summary: "Verify user 2FA — returns token" } },
    "/auth/setup-2fa/verify": { post: { tags: ["auth"], summary: "Enroll user 2FA (first-time) — returns token" } },
    "/auth/refresh": { post: { tags: ["auth"], summary: "Refresh JWT (grace window)" } },
    "/auth/me": { get: { tags: ["auth"], summary: "Get current user", security: [{ bearerAuth: [] }] } },
    "/auth/profile": { patch: { tags: ["auth"], summary: "Update email/password", security: [{ bearerAuth: [] }] } },
    "/auth/recovery-code": {
      post: { tags: ["auth"], summary: "Generate recovery code", security: [{ bearerAuth: [] }] },
      delete: { tags: ["auth"], summary: "Remove recovery code", security: [{ bearerAuth: [] }] },
    },
    "/auth/recover-password": { post: { tags: ["auth"], summary: "Reset password using recovery code" } },
    "/auth/avatar": {
      post: { tags: ["auth"], summary: "Upload avatar", security: [{ bearerAuth: [] }] },
      delete: { tags: ["auth"], summary: "Remove avatar", security: [{ bearerAuth: [] }] },
    },

    "/expenses": {
      get: { tags: ["expenses"], summary: "List expenses", security: [{ bearerAuth: [] }] },
      post: { tags: ["expenses"], summary: "Create expense", security: [{ bearerAuth: [] }] },
    },
    "/expenses/{id}": {
      get: { tags: ["expenses"], summary: "Get expense", security: [{ bearerAuth: [] }] },
      patch: { tags: ["expenses"], summary: "Update expense", security: [{ bearerAuth: [] }] },
      delete: { tags: ["expenses"], summary: "Delete expense", security: [{ bearerAuth: [] }] },
    },

    "/imports": { post: { tags: ["imports"], summary: "Upload statement (create batch)", security: [{ bearerAuth: [] }] } },
    "/imports/batches/{batchId}": { get: { tags: ["imports"], summary: "Get batch", security: [{ bearerAuth: [] }] } },
    "/imports/batches/{batchId}/commit": {
      post: { tags: ["imports"], summary: "Commit staging rows to expenses", security: [{ bearerAuth: [] }] },
    },
    "/imports/rows/{id}": { patch: { tags: ["imports"], summary: "Update staging row", security: [{ bearerAuth: [] }] } },

    "/reports/monthly": { get: { tags: ["reports"], summary: "Monthly report", security: [{ bearerAuth: [] }] } },
    "/reports/export/monthly.csv": {
      get: { tags: ["reports"], summary: "Export monthly spending and budget CSV", security: [{ bearerAuth: [] }] },
    },
    "/reports/export/monthly.pdf": {
      get: { tags: ["reports"], summary: "Export monthly PDF report", security: [{ bearerAuth: [] }] },
    },
    "/reports/cashflow/monthly": {
      get: { tags: ["reports"], summary: "Monthly income vs spending (actuals)", security: [{ bearerAuth: [] }] },
    },
    "/reports/run-rate-vs-income": {
      get: {
        tags: ["reports"],
        summary: "Recurring run rate: income vs expenses, renewals, prescriptions, plans",
        security: [{ bearerAuth: [] }],
      },
    },
    "/reports/summary": { get: { tags: ["reports"], summary: "Stored monthly summaries", security: [{ bearerAuth: [] }] } },

    "/budgets/{year}/{month}": {
      get: { tags: ["budgets"], summary: "Get monthly budget, actuals, variance", security: [{ bearerAuth: [] }] },
      put: { tags: ["budgets"], summary: "Save monthly budget and category lines", security: [{ bearerAuth: [] }] },
      delete: { tags: ["budgets"], summary: "Delete monthly budget", security: [{ bearerAuth: [] }] },
    },

    "/notifications": { get: { tags: ["notifications"], summary: "List notifications (syncs budget alerts)", security: [{ bearerAuth: [] }] } },
    "/notifications/{id}/read": {
      patch: { tags: ["notifications"], summary: "Mark notification read", security: [{ bearerAuth: [] }] },
    },
    "/notifications/read-all": {
      post: { tags: ["notifications"], summary: "Mark all notifications read", security: [{ bearerAuth: [] }] },
    },

    "/income": {
      get: { tags: ["income"], summary: "List income entries", security: [{ bearerAuth: [] }] },
      post: { tags: ["income"], summary: "Create income entry", security: [{ bearerAuth: [] }] },
    },
    "/income/{id}": {
      get: { tags: ["income"], summary: "Get income entry", security: [{ bearerAuth: [] }] },
      patch: { tags: ["income"], summary: "Update income entry", security: [{ bearerAuth: [] }] },
      delete: { tags: ["income"], summary: "Delete income entry", security: [{ bearerAuth: [] }] },
    },

    "/backup/export": {
      get: {
        tags: ["backup"],
        summary: "Export user backup JSON",
        description:
          "Downloads **`expense-tracker-backup`** JSON, **`version: 4`**, with **expenseCount**, **renewalCount**, **prescriptions**, **paymentPlans**, **incomeEntryCount** / **incomeEntries**, optional **account.recoveryCode**, and legacy top-level **email**.",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": {
            description: "Backup file JSON",
            content: { "application/json": { schema: { $ref: "#/components/schemas/UserBackupExport" } } },
          },
        },
      },
    },
    "/backup/restore": {
      post: {
        tags: ["backup"],
        summary: "Restore user backup JSON",
        description:
          "Body: export payload plus **mode** **append** or **replace**. Max **25,000** rows per array; body limit **15 MB**. **version** **4** requires **incomeEntries** array (may be **[]**). **409** **BACKUP_ACCOUNT_MISMATCH** if backup email differs unless **confirmCrossAccountRestore**.",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/BackupRestoreRequest" } } },
        },
        responses: {
          "200": { description: "Restore result with restored counts and restoredBreakdown" },
          "400": { description: "Validation error" },
          "409": { description: "Cross-account restore not confirmed" },
        },
      },
    },

    "/prescriptions": {
      get: { tags: ["prescriptions"], summary: "List prescriptions", security: [{ bearerAuth: [] }] },
      post: { tags: ["prescriptions"], summary: "Create prescription", security: [{ bearerAuth: [] }] },
    },
    "/prescriptions/{id}": {
      get: { tags: ["prescriptions"], summary: "Get prescription", security: [{ bearerAuth: [] }] },
      patch: { tags: ["prescriptions"], summary: "Update prescription", security: [{ bearerAuth: [] }] },
      delete: { tags: ["prescriptions"], summary: "Delete prescription", security: [{ bearerAuth: [] }] },
    },

    "/payment-plans": {
      get: { tags: ["payment-plans"], summary: "List payment plans", security: [{ bearerAuth: [] }] },
      post: { tags: ["payment-plans"], summary: "Create payment plan", security: [{ bearerAuth: [] }] },
    },
    "/payment-plans/{id}": {
      patch: { tags: ["payment-plans"], summary: "Update payment plan", security: [{ bearerAuth: [] }] },
      delete: { tags: ["payment-plans"], summary: "Delete payment plan", security: [{ bearerAuth: [] }] },
    },

    "/admin/auth/login": { post: { tags: ["admin"], summary: "Admin login (password) — returns challengeId" } },
    "/admin/auth/verify-2fa": { post: { tags: ["admin"], summary: "Admin verify 2FA — returns token" } },
    "/admin/auth/setup-2fa/verify": { post: { tags: ["admin"], summary: "Admin enroll 2FA (first-time) — returns token" } },
    "/admin/auth/change-password": {
      post: { tags: ["admin"], summary: "Change admin password", security: [{ adminBearerAuth: [] }] },
    },
    "/admin/auth/reauth": { post: { tags: ["admin"], summary: "Re-authenticate sensitive ops", security: [{ adminBearerAuth: [] }] } },

    "/admin/health": { get: { tags: ["admin"], summary: "Admin system health", security: [{ adminBearerAuth: [] }] } },
    "/admin/users": { get: { tags: ["admin"], summary: "List users", security: [{ adminBearerAuth: [] }] } },
    "/admin/backup/user/{userId}": {
      get: {
        tags: ["admin"],
        summary: "Backup a single user",
        description:
          "Returns **`expense-tracker-admin-user-backup`**, **`version: 2`**: user row, **expenses**, **prescriptions**, **paymentPlans**, **incomeEntries**, and **counts**.",
        security: [{ adminBearerAuth: [] }],
      },
    },
    "/admin/backup/database": {
      get: {
        tags: ["admin"],
        summary: "Backup whole database (reauth required)",
        description:
          "Returns **`expense-tracker-admin-db-backup`**, **`version: 2`**: **users**, **expenses**, **prescriptions**, **paymentPlans**, **incomeEntries** (full rows for restore).",
        security: [{ adminBearerAuth: [], adminReauth: [] }],
      },
    },
    "/admin/restore/preview": {
      post: {
        tags: ["admin"],
        summary: "Preview restore integrity",
        description: "Validates **user_id** references for expenses, prescriptions, payment plans, and income entries.",
        security: [{ adminBearerAuth: [] }],
      },
    },
    "/admin/restore/database": {
      post: {
        tags: ["admin"],
        summary: "Restore whole database (reauth required)",
        description:
          "Destructive **replace**: clears plans, prescriptions, expenses, **income_entries**, users; reloads from backup (**version** **2** includes **incomeEntries**).",
        security: [{ adminBearerAuth: [], adminReauth: [] }],
      },
    },
    "/admin/users/{userId}/reset-password": {
      post: {
        tags: ["admin"],
        summary: "Reset user password (reauth required)",
        security: [{ adminBearerAuth: [], adminReauth: [] }],
      },
    },
    "/admin/users/{userId}/permissions": {
      patch: {
        tags: ["admin"],
        summary: "Update user role/permissions (reauth required)",
        security: [{ adminBearerAuth: [], adminReauth: [] }],
      },
    },
  },
};

