import Mailgun from "mailgun.js";
import FormData from "form-data";

let mg = null;

function getClient() {
  if (!process.env.MAILGUN_API_KEY) return null;
  if (!mg) {
    const mailgun = new Mailgun(FormData);
    mg = mailgun.client({
      username: "api",
      key: process.env.MAILGUN_API_KEY,
      url:
        String(process.env.MAILGUN_REGION || "us").toLowerCase() === "eu"
          ? "https://api.eu.mailgun.net"
          : "https://api.mailgun.net",
    });
  }
  return mg;
}

function logMailgunError(context, e) {
  const status = e?.status ?? "?";
  const message = e?.message ?? String(e);
  const details = e?.details ?? "";
  console.error(
    `email: ${context} failed [${status}] ${message}${details ? " — " + details : ""}`
  );
  if (status === 403) {
    console.error(
      "email: 403 Forbidden — likely cause: domain not verified in Mailgun, " +
      "or the API key does not have permission for MAILGUN_DOMAIN=" +
      (process.env.MAILGUN_DOMAIN ?? "(unset)") +
      ". Check the Mailgun dashboard → Sending → Domains."
    );
  }
  if (status === 401) {
    console.error("email: 401 Unauthorized — MAILGUN_API_KEY is invalid or revoked.");
  }
}

/**
 * Send an email via Mailgun. No-ops silently when MAILGUN_API_KEY is not set.
 * @param {{ to: string, subject: string, html: string, text: string }} opts
 */
export async function sendEmail({ to, subject, html, text }) {
  const client = getClient();
  if (!client) return;

  const domain = process.env.MAILGUN_DOMAIN;
  const fromName = process.env.MAIL_FROM_NAME || "UrExpense";
  const fromAddress = process.env.MAIL_FROM_ADDRESS;
  if (!domain || !fromAddress) {
    console.warn("email: MAILGUN_DOMAIN or MAIL_FROM_ADDRESS not set — skipping");
    return;
  }

  try {
    await client.messages.create(domain, {
      from: `${fromName} <${fromAddress}>`,
      to: [to],
      subject,
      html,
      text,
    });
  } catch (e) {
    logMailgunError(`send to ${to}`, e);
  }
}

/**
 * Called once at startup. Verifies the configured domain exists and is accessible
 * with the current API key. Logs a clear warning if not — does not throw.
 */
export async function verifyMailgunConfig() {
  const apiKey = process.env.MAILGUN_API_KEY;
  const domain = process.env.MAILGUN_DOMAIN;
  const fromAddress = process.env.MAIL_FROM_ADDRESS;

  if (!apiKey) {
    console.log("email: MAILGUN_API_KEY not set — email notifications disabled");
    return;
  }
  if (!domain || !fromAddress) {
    console.warn("email: MAILGUN_DOMAIN or MAIL_FROM_ADDRESS not set — email notifications disabled");
    return;
  }

  const client = getClient();
  try {
    await client.domains.get(domain);
    console.log(`email: Mailgun OK — domain ${domain} is verified and ready`);
  } catch (e) {
    logMailgunError(`domain verification for ${domain}`, e);
  }
}
