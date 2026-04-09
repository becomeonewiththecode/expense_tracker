export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "Expense Tracker API",
    version: "1.0.0",
    description:
      "REST API for Expense Tracker. Most endpoints require a user JWT (Authorization: Bearer). Admin endpoints under /api/admin use a separate admin session token.",
  },
  servers: [{ url: "/api" }],
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
      adminBearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
      adminReauth: { type: "apiKey", in: "header", name: "x-admin-reauth" },
    },
  },
  tags: [
    { name: "auth" },
    { name: "expenses" },
    { name: "imports" },
    { name: "reports" },
    { name: "backup" },
    { name: "prescriptions" },
    { name: "payment-plans" },
    { name: "admin" },
  ],
  paths: {
    "/auth/register": { post: { tags: ["auth"], summary: "Register user" } },
    "/auth/login": { post: { tags: ["auth"], summary: "Login user" } },
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
    "/reports/summary": { get: { tags: ["reports"], summary: "Stored monthly summaries", security: [{ bearerAuth: [] }] } },

    "/backup/export": { get: { tags: ["backup"], summary: "Export user backup JSON", security: [{ bearerAuth: [] }] } },
    "/backup/restore": { post: { tags: ["backup"], summary: "Restore user backup JSON", security: [{ bearerAuth: [] }] } },

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
    "/admin/backup/user/{userId}": { get: { tags: ["admin"], summary: "Backup a single user", security: [{ adminBearerAuth: [] }] } },
    "/admin/backup/database": {
      get: {
        tags: ["admin"],
        summary: "Backup whole database (reauth required)",
        security: [{ adminBearerAuth: [], adminReauth: [] }],
      },
    },
    "/admin/restore/preview": { post: { tags: ["admin"], summary: "Preview restore integrity", security: [{ adminBearerAuth: [] }] } },
    "/admin/restore/database": {
      post: {
        tags: ["admin"],
        summary: "Restore whole database (reauth required)",
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

