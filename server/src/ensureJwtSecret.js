import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envDir = path.join(__dirname, "..");
const envPath = path.join(envDir, ".env");
const examplePath = path.join(envDir, ".env.example");

const MIN_LEN = 16;

function needsNewSecret(s) {
  if (s == null || String(s).trim().length < MIN_LEN) return true;
  const t = String(s).trim();
  if (/^change-me/i.test(t)) return true;
  return false;
}

function upsertJwtSecretLine(content, secret) {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  let found = false;
  const out = lines.map((line) => {
    if (/^\s*JWT_SECRET\s*=/.test(line)) {
      found = true;
      return `JWT_SECRET=${secret}`;
    }
    return line;
  });
  if (!found) {
    if (out.length && out[out.length - 1].length > 0) out.push("");
    out.push(`JWT_SECRET=${secret}`);
  }
  return out.join("\n").replace(/\n*$/, "\n");
}

/**
 * If JWT_SECRET is missing or weak, generate one and persist to server/.env
 * so it stays stable across restarts (same idea as committing .env manually).
 */
export function ensureJwtSecret() {
  const current = process.env.JWT_SECRET;
  if (!needsNewSecret(current)) return;

  const secret = crypto.randomBytes(32).toString("base64url");
  let body = "";
  if (fs.existsSync(envPath)) {
    body = fs.readFileSync(envPath, "utf8");
  } else if (fs.existsSync(examplePath)) {
    body = fs.readFileSync(examplePath, "utf8");
  } else {
    body = [
      "PORT=4000",
      "DATABASE_URL=postgresql://expense:expense@localhost:5432/expense_tracker",
      "REDIS_URL=redis://localhost:6379",
      "CLIENT_ORIGIN=http://localhost:5173",
      "",
    ].join("\n");
  }

  fs.writeFileSync(envPath, upsertJwtSecretLine(body, secret), { mode: 0o600 });
  process.env.JWT_SECRET = secret;
  console.info("Generated JWT_SECRET and wrote it to server/.env (first-time setup).");
}
