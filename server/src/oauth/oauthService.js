import { pool } from "../db.js";

/**
 * @param {string} base - e.g. http://localhost:5173 (no trailing slash)
 * @param {string} provider
 */
export function oauthRedirectUri(base, provider) {
  const b = String(base || "").replace(/\/$/, "");
  return `${b}/api/auth/oauth/${provider}/callback`;
}

async function fetchJson(url, opts = {}, { oauthToken = false } = {}) {
  const res = await fetch(url, opts);
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (oauthToken && (data.error || !data.access_token)) {
    const msg =
      data.error_description ||
      (typeof data.error === "string" ? data.error : data.error ? JSON.stringify(data.error) : "") ||
      "OAuth token exchange failed";
    const err = new Error(msg);
    err.statusCode = res.status;
    throw err;
  }
  if (!res.ok) {
    const msg =
      data.error_description ||
      (typeof data.error === "string" ? data.error : data.error?.message) ||
      data.message ||
      res.statusText ||
      "HTTP error";
    const err = new Error(msg);
    err.statusCode = res.status;
    throw err;
  }
  return data;
}

export async function exchangeGoogleCode({ code, clientId, clientSecret, redirectUri }) {
  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });
  const token = await fetchJson(
    "https://oauth2.googleapis.com/token",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    },
    { oauthToken: true }
  );
  const profile = await fetchJson("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });
  const email = String(profile.email || "").trim().toLowerCase();
  const sub = String(profile.sub || "");
  if (!email || !sub) throw new Error("Google did not return email or subject");
  return { providerUserId: sub, email };
}

export async function exchangeGithubCode({ code, clientId, clientSecret, redirectUri }) {
  const body = JSON.stringify({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
  });
  const token = await fetchJson(
    "https://github.com/login/oauth/access_token",
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body,
    },
    { oauthToken: true }
  );
  const auth = { Authorization: `Bearer ${token.access_token}` };
  const user = await fetchJson("https://api.github.com/user", { headers: auth });
  let email = String(user.email || "").trim().toLowerCase();
  if (!email) {
    const emails = await fetchJson("https://api.github.com/user/emails", { headers: auth });
    const list = Array.isArray(emails) ? emails : [];
    const primary = list.find((e) => e.primary) || list.find((e) => e.verified) || list[0];
    email = String(primary?.email || "").trim().toLowerCase();
  }
  const id = String(user.id ?? "");
  if (!id) throw new Error("GitHub user id missing");
  if (!email) throw new Error("GitHub did not return a verified email");
  return { providerUserId: id, email };
}

export async function exchangeGitlabCode({ code, clientId, clientSecret, redirectUri, baseUrl }) {
  const base = String(baseUrl || "https://gitlab.com").replace(/\/$/, "");
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
  });
  const token = await fetchJson(
    `${base}/oauth/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    },
    { oauthToken: true }
  );
  const profile = await fetchJson(`${base}/api/v4/user`, {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });
  const email = String(profile.email || "").trim().toLowerCase();
  const id = String(profile.id ?? "");
  if (!email || !id) throw new Error("GitLab did not return email or id");
  return { providerUserId: id, email };
}

export async function exchangeMicrosoftCode({ code, clientId, clientSecret, redirectUri, tenant }) {
  const t = String(tenant || "common");
  const tokenUrl = `https://login.microsoftonline.com/${t}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
    scope: "openid email profile https://graph.microsoft.com/User.Read",
  });
  const token = await fetchJson(
    tokenUrl,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    },
    { oauthToken: true }
  );
  const profile = await fetchJson("https://graph.microsoft.com/v1.0/me", {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });
  const email = String(profile.mail || profile.userPrincipalName || "").trim().toLowerCase();
  const id = String(profile.id || "");
  if (!email || !id) throw new Error("Microsoft did not return id or email");
  return { providerUserId: id, email };
}

export async function findOrCreateUserFromOAuth(provider, providerUserId, email) {
  const e = String(email).trim().toLowerCase();
  const { rows: existingLink } = await pool.query(
    `SELECT user_id FROM oauth_identities WHERE provider = $1 AND provider_user_id = $2`,
    [provider, providerUserId]
  );
  if (existingLink[0]) {
    const { rows } = await pool.query(
      `SELECT id, email, avatar_url, (password_hash IS NOT NULL) AS has_password FROM users WHERE id = $1`,
      [existingLink[0].user_id]
    );
    if (!rows[0]) throw new Error("User missing for OAuth link");
    return rows[0];
  }

  const { rows: byEmail } = await pool.query(
    `SELECT id, email, avatar_url, (password_hash IS NOT NULL) AS has_password FROM users WHERE email = $1`,
    [e]
  );
  if (byEmail[0]) {
    await pool.query(
      `INSERT INTO oauth_identities (user_id, provider, provider_user_id, email) VALUES ($1, $2, $3, $4)`,
      [byEmail[0].id, provider, providerUserId, e]
    );
    return {
      id: byEmail[0].id,
      email: byEmail[0].email,
      avatar_url: byEmail[0].avatar_url,
      has_password: byEmail[0].has_password,
    };
  }

  const { rows } = await pool.query(
    `INSERT INTO users (email, password_hash) VALUES ($1, NULL) RETURNING id, email, avatar_url`,
    [e]
  );
  const user = rows[0];
  await pool.query(
    `INSERT INTO oauth_identities (user_id, provider, provider_user_id, email) VALUES ($1, $2, $3, $4)`,
    [user.id, provider, providerUserId, e]
  );
  return {
    id: user.id,
    email: user.email,
    avatar_url: user.avatar_url,
    has_password: false,
  };
}
