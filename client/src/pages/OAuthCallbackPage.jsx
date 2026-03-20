import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth.jsx";
import { getPostLoginPath } from "../postLoginLanding.js";

function parseJwtPayload(token) {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    let b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4;
    if (pad) b64 += "=".repeat(4 - pad);
    return JSON.parse(atob(b64));
  } catch {
    return null;
  }
}

export default function OAuthCallbackPage() {
  const { setSession } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    const err = params.get("error");
    if (err) {
      setError(err);
      return;
    }
    if (!token) {
      setError("Missing token");
      return;
    }
    const payload = parseJwtPayload(token);
    if (!payload?.sub) {
      setError("Invalid token");
      return;
    }
    const user = {
      id: payload.sub,
      email: payload.email || "",
    };
    setSession(token, user);
    let cancelled = false;
    getPostLoginPath().then((path) => {
      if (!cancelled) navigate(path, { replace: true });
    });
    return () => {
      cancelled = true;
    };
  }, [navigate, setSession]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md text-center space-y-4">
          <p className="text-rose-400 text-sm">{error}</p>
          <a href="/login" className="text-emerald-400 hover:underline text-sm">
            Back to sign in
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center text-slate-500 text-sm">
      Completing sign-in…
    </div>
  );
}
