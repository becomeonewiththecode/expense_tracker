import crypto from "crypto";
import bcrypt from "bcryptjs";

function getKey() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is required");
  }
  return crypto.createHash("sha256").update(`recovery-ciphertext:${secret}`).digest();
}

/** Same derivation as auth recover-password lookup. */
export function recoveryLookupFromCode(plain) {
  return crypto.createHash("sha256").update(plain, "utf8").digest("hex").slice(0, 12);
}

export function encryptRecoveryPlain(plain, userId) {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const aad = Buffer.from(`uid:${userId}`, "utf8");
  cipher.setAAD(aad);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64url");
}

export function decryptRecoveryStored(b64, userId) {
  if (!b64 || typeof b64 !== "string") return null;
  try {
    const buf = Buffer.from(b64, "base64url");
    if (buf.length < 12 + 16 + 1) return null;
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const data = buf.subarray(28);
    const decipher = crypto.createDecipheriv("aes-256-gcm", getKey(), iv);
    decipher.setAAD(Buffer.from(`uid:${userId}`, "utf8"));
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

/**
 * Persists bcrypt hash + lookup + encrypted plaintext for backup export.
 * @param {{ query: (sql: string, params?: unknown[]) => Promise<unknown> }} db
 */
export async function persistRecoveryCodeForUser(db, userId, plain) {
  const lookup = recoveryLookupFromCode(plain);
  const hash = await bcrypt.hash(plain, 10);
  const ciphertext = encryptRecoveryPlain(plain, userId);
  await db.query(
    `UPDATE users SET recovery_lookup = $1, recovery_token_hash = $2, recovery_code_ciphertext = $3 WHERE id = $4`,
    [lookup, hash, ciphertext, userId]
  );
}

export function isPlausibleRecoveryCode(s) {
  if (typeof s !== "string") return false;
  const t = s.trim();
  return t.length >= 8 && t.length <= 512;
}
