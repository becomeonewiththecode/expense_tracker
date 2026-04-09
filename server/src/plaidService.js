import { Configuration, PlaidApi, PlaidEnvironments, Products } from "plaid";

function plaidBasePath() {
  const envName = String(process.env.PLAID_ENV || "sandbox").toLowerCase();
  if (envName === "production") return PlaidEnvironments.production;
  return PlaidEnvironments.sandbox;
}

/** @returns {PlaidApi | null} */
export function getPlaidClient() {
  const id = String(process.env.PLAID_CLIENT_ID || "").trim();
  const secret = String(process.env.PLAID_SECRET || "").trim();
  if (!id || !secret) return null;
  const configuration = new Configuration({
    basePath: plaidBasePath(),
    baseOptions: {
      headers: {
        "PLAID-CLIENT-ID": id,
        "PLAID-SECRET": secret,
      },
    },
  });
  return new PlaidApi(configuration);
}

export function isPlaidConfigured() {
  return Boolean(
    String(process.env.PLAID_CLIENT_ID || "").trim() && String(process.env.PLAID_SECRET || "").trim()
  );
}

export function plaidCountryCodes() {
  const raw = String(process.env.PLAID_COUNTRY_CODES || "US");
  return raw
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
}

export { Products };
