import { pool } from "../db.js";
import { ipRateLimit } from "../rateLimit.js";
import { createOAuthState, consumeOAuthState } from "./oauthState.js";
import { issueUserSession, verifyUserSessionToken } from "../userSecurity.js";
import { consumeOAuthLoginCode, createOAuthLoginCode } from "./oauthLoginCode.js";
import {
  exchangeGithubCode,
  exchangeGitlabCode,
  exchangeGoogleCode,
  exchangeMicrosoftCode,
  findOrCreateUserFromOAuth,
  oauthRedirectUri,
} from "./oauthService.js";

function clientOrigin() {
  return String(process.env.CLIENT_ORIGIN || "http://localhost:5173").replace(/\/$/, "");
}

function envKey(provider, suffix) {
  const map = { google: "GOOGLE", github: "GITHUB", gitlab: "GITLAB", microsoft: "MICROSOFT" };
  const p = map[provider];
  return p ? `OAUTH_${p}_${suffix}` : null;
}

function getClientCreds(provider) {
  const id = process.env[envKey(provider, "CLIENT_ID")];
  const secret = process.env[envKey(provider, "CLIENT_SECRET")];
  return { clientId: id, clientSecret: secret };
}

function authorizeUrl(provider, { clientId, redirectUri, state }) {
  const enc = encodeURIComponent;
  switch (provider) {
    case "google":
      return (
        `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${enc(clientId)}&redirect_uri=${enc(redirectUri)}&response_type=code&` +
        `scope=${enc("openid email profile")}&state=${enc(state)}&access_type=offline&prompt=select_account`
      );
    case "github":
      return (
        `https://github.com/login/oauth/authorize?` +
        `client_id=${enc(clientId)}&redirect_uri=${enc(redirectUri)}&state=${enc(state)}&` +
        `scope=${enc("read:user user:email")}`
      );
    case "gitlab": {
      const base = String(process.env.OAUTH_GITLAB_BASE_URL || "https://gitlab.com").replace(/\/$/, "");
      return (
        `${base}/oauth/authorize?` +
        `client_id=${enc(clientId)}&redirect_uri=${enc(redirectUri)}&response_type=code&state=${enc(state)}&` +
        `scope=${enc("read_user")}`
      );
    }
    case "microsoft": {
      const tenant = process.env.OAUTH_MICROSOFT_TENANT || "common";
      return (
        `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize?` +
        `client_id=${enc(clientId)}&response_type=code&redirect_uri=${enc(redirectUri)}&` +
        `scope=${enc("openid email profile https://graph.microsoft.com/User.Read")}&state=${enc(state)}&response_mode=query`
      );
    }
    default:
      return null;
  }
}

function redirectWithLoginCode(res, token) {
  const origin = clientOrigin();
  const code = createOAuthLoginCode(token);
  const url = `${origin}/oauth/callback?login_code=${encodeURIComponent(code)}`;
  return res.redirect(302, url);
}

function redirectWithError(res, message) {
  const origin = clientOrigin();
  const url = `${origin}/oauth/callback?error=${encodeURIComponent(message)}`;
  return res.redirect(302, url);
}

/**
 * @param {import('express').Router} authRouter
 */
const oauthExchangeLimiter = ipRateLimit({ windowMs: 60_000, max: 40, name: "oauth-exchange" });

export function registerOAuthRoutes(authRouter) {
  authRouter.post("/oauth/login-code", oauthExchangeLimiter, async (req, res) => {
    const code = String(req.body?.code || "").trim();
    if (!code) {
      return res.status(400).json({ error: "code is required" });
    }
    const token = consumeOAuthLoginCode(code);
    if (!token) {
      return res.status(401).json({ error: "Invalid or expired login code" });
    }
    const verified = verifyUserSessionToken(token);
    if (!verified.ok) {
      return res.status(401).json({ error: verified.error });
    }
    try {
      const { rows } = await pool.query(
        `SELECT id, email, avatar_url, (password_hash IS NOT NULL) AS has_password,
          (recovery_lookup IS NOT NULL) AS has_recovery_code, (totp_secret IS NOT NULL) AS has_2fa
        FROM users WHERE id = $1`,
        [verified.userId]
      );
      if (!rows[0]) {
        return res.status(401).json({ error: "User not found" });
      }
      const u = rows[0];
      res.json({
        token,
        user: {
          id: u.id,
          email: u.email,
          avatar_url: u.avatar_url,
          has_password: u.has_password,
          has_recovery_code: u.has_recovery_code,
          has_2fa: u.has_2fa,
        },
      });
    } catch (e) {
      console.error("oauth/login-code:", e);
      res.status(500).json({ error: "Exchange failed" });
    }
  });

  authRouter.get("/oauth/:provider", (req, res) => {
    const provider = String(req.params.provider || "").toLowerCase();
    if (!["google", "github", "gitlab", "microsoft"].includes(provider)) {
      return res.status(404).json({ error: "Unknown OAuth provider" });
    }
    const { clientId, clientSecret } = getClientCreds(provider);
    if (!clientId || !clientSecret) {
      return res.status(503).json({
        error: `OAuth is not configured for ${provider}. Set ${envKey(provider, "CLIENT_ID")} and CLIENT_SECRET in server/.env`,
      });
    }
    const base = clientOrigin();
    const redirectUri = oauthRedirectUri(base, provider);
    const state = createOAuthState(provider);
    const url = authorizeUrl(provider, { clientId, redirectUri, state });
    if (!url) return res.status(500).json({ error: "OAuth URL build failed" });
    return res.redirect(302, url);
  });

  authRouter.get("/oauth/:provider/callback", async (req, res) => {
    const provider = String(req.params.provider || "").toLowerCase();
    const code = req.query.code ? String(req.query.code) : "";
    const state = req.query.state ? String(req.query.state) : "";
    const errQ = req.query.error ? String(req.query.error) : "";

    if (errQ) {
      return redirectWithError(res, req.query.error_description || errQ);
    }
    if (!code || !state) {
      return redirectWithError(res, "Missing code or state");
    }

    const expectedProvider = consumeOAuthState(state);
    if (!expectedProvider || expectedProvider !== provider) {
      return redirectWithError(res, "Invalid or expired OAuth state");
    }

    const { clientId, clientSecret } = getClientCreds(provider);
    if (!clientId || !clientSecret) {
      return redirectWithError(res, `OAuth not configured for ${provider}`);
    }

    const base = clientOrigin();
    const redirectUri = oauthRedirectUri(base, provider);

    try {
      let profile;
      if (provider === "google") {
        profile = await exchangeGoogleCode({ code, clientId, clientSecret, redirectUri });
      } else if (provider === "github") {
        profile = await exchangeGithubCode({ code, clientId, clientSecret, redirectUri });
      } else if (provider === "gitlab") {
        profile = await exchangeGitlabCode({
          code,
          clientId,
          clientSecret,
          redirectUri,
          baseUrl: process.env.OAUTH_GITLAB_BASE_URL,
        });
      } else if (provider === "microsoft") {
        profile = await exchangeMicrosoftCode({
          code,
          clientId,
          clientSecret,
          redirectUri,
          tenant: process.env.OAUTH_MICROSOFT_TENANT,
        });
      } else {
        return redirectWithError(res, "Unknown provider");
      }

      const user = await findOrCreateUserFromOAuth(provider, profile.providerUserId, profile.email);
      const token = issueUserSession(user);
      return redirectWithLoginCode(res, token);
    } catch (e) {
      console.error("OAuth callback error:", e);
      const msg = e?.message || "OAuth failed";
      return redirectWithError(res, msg);
    }
  });
}
