#!/usr/bin/env node
/**
 * Ensures deployment/docker-compose/.env exists and has a strong JWT_SECRET.
 * Run automatically before `npm run compose:prod`, or manually:
 *   node deployment/docker-compose/ensure-env.mjs
 *
 * Writes to the host .env file (gitignored) so the secret survives container rebuilds.
 */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, ".env");
const examplePath = path.join(__dirname, ".env.example");

const MIN_LEN = 16;

function needsNewSecret(value) {
  if (value == null) return true;
  const t = String(value).trim();
  if (t.length < MIN_LEN) return true;
  if (/^change-me/i.test(t)) return true;
  return false;
}

function parseJwtSecretFromEnv(body) {
  const m = body.match(/^\s*JWT_SECRET\s*=\s*(.*)$/m);
  if (!m) return { raw: null, value: null };
  const raw = m[1].replace(/\s*#.*$/, "").trim();
  const unquoted = raw.replace(/^["']|["']$/g, "");
  return { raw: m[0], value: unquoted };
}

if (!fs.existsSync(examplePath)) {
  console.error("Missing deployment/docker-compose/.env.example");
  process.exit(1);
}

if (!fs.existsSync(envPath)) {
  fs.copyFileSync(examplePath, envPath);
  fs.chmodSync(envPath, 0o600);
  console.info("Created deployment/docker-compose/.env from .env.example");
}

let body = fs.readFileSync(envPath, "utf8");
const { value: current } = parseJwtSecretFromEnv(body);

if (!needsNewSecret(current)) {
  console.info("deployment/docker-compose/.env already has a valid JWT_SECRET.");
  process.exit(0);
}

const secret = crypto.randomBytes(32).toString("base64url");
if (/^\s*JWT_SECRET\s*=/m.test(body)) {
  body = body.replace(/^\s*JWT_SECRET\s*=.*$/m, `JWT_SECRET=${secret}`);
} else {
  if (body.length && !body.endsWith("\n")) body += "\n";
  body += `JWT_SECRET=${secret}\n`;
}

fs.writeFileSync(envPath, body, { mode: 0o600 });
console.info("Generated JWT_SECRET and wrote it to deployment/docker-compose/.env (keep this file; do not commit).");
