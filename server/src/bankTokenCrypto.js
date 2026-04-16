import crypto from "crypto";

const PREFIX = "v1:";

let _cachedKey = null;
function getKey() {
  if (_cachedKey) return _cachedKey;
  const configured = String(process.env.BANK_TOKEN_ENCRYPTION_KEY || "").trim();
  const source = configured || String(process.env.JWT_SECRET || "").trim();
  if (!source) {
    throw new Error("BANK_TOKEN_ENCRYPTION_KEY or JWT_SECRET is required");
  }
  _cachedKey = crypto.createHash("sha256").update(`bank-token:${source}`, "utf8").digest();
  return _cachedKey;
}

export function isEncryptedBankToken(value) {
  return typeof value === "string" && value.startsWith(PREFIX);
}

export function encryptBankToken(plain) {
  const token = String(plain || "").trim();
  if (!token) return "";
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  const enc = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${Buffer.concat([iv, tag, enc]).toString("base64url")}`;
}

export function decryptBankToken(stored) {
  if (!stored || typeof stored !== "string") return null;
  if (!isEncryptedBankToken(stored)) {
    // Backwards compatibility with old plaintext rows.
    return stored;
  }
  const raw = stored.slice(PREFIX.length);
  try {
    const buf = Buffer.from(raw, "base64url");
    if (buf.length < 12 + 16 + 1) return null;
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const data = buf.subarray(28);
    const decipher = crypto.createDecipheriv("aes-256-gcm", getKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
