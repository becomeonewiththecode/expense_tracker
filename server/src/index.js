import "dotenv/config";
import express from "express";
import cors from "cors";
import { ensureJwtSecret } from "./ensureJwtSecret.js";
import { initDb, pool } from "./db.js";
import { authRouter } from "./routes/auth.js";
import { expensesRouter } from "./routes/expenses.js";
import { importsRouter } from "./routes/imports.js";
import { reportsRouter } from "./routes/reports.js";
import { startMonthlySummaryJob } from "./jobs/monthlySummary.js";

const app = express();
app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || true,
    credentials: true,
  })
);
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/auth", authRouter);
app.use("/api/expenses", expensesRouter);
app.use("/api/imports", importsRouter);
app.use("/api/reports", reportsRouter);

app.use((err, _req, res, _next) => {
  console.error("unhandled:", err);
  const status = Number(err?.statusCode || err?.status) || 500;
  const message =
    typeof err?.message === "string" && err.message.length
      ? err.message
      : "Internal server error";
  res.status(status).json({ error: message });
});

const port = Number(process.env.PORT) || 4000;

async function main() {
  ensureJwtSecret();
  await initDb();
  startMonthlySummaryJob();
  const server = app.listen(port, () => {
    console.log(`API listening on http://localhost:${port}`);
  });
  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.error(
        `\nPort ${port} is already in use. Another program may be using it (often causes "Empty reply" when you curl).\n` +
          `Fix: stop that process, or set PORT=4001 in server/.env and API_PROXY_TARGET=http://127.0.0.1:4001 in client/.env\n`
      );
    } else {
      console.error(err);
    }
    process.exit(1);
  });
}

main().catch((e) => {
  console.error(e);
  pool.end().catch(() => {});
  process.exit(1);
});
