import jwt from "jsonwebtoken";
import { createOAuthState, consumeOAuthState } from "./oauthState.js";
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

function issueToken(user) {
  const secret = process.env.JWT_SECRET;
  return jwt.sign({ sub: user.id, email: user.email }, secret, { expiresIn: "7d" });
}

function redirectWithToken(res, token) {
  const origin = clientOrigin();
  const url = `${origin}/oauth/callback?token=${encodeURIComponent(token)}`;
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
export function registerOAuthRoutes(authRouter) {
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
      const token = issueToken(user);
      return redirectWithToken(res, token);
    } catch (e) {
      console.error("OAuth callback error:", e);
      const msg = e?.message || "OAuth failed";
      return redirectWithError(res, msg);
    }
  });
}
