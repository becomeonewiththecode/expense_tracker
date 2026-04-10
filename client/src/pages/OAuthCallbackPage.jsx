import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api.js";
import { getApiErrorMessage } from "../apiError.js";
import { useAuth } from "../auth.jsx";
import { getPostLoginPath } from "../postLoginLanding.js";

export default function OAuthCallbackPage() {
  const { setSession } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const loginCode = params.get("login_code");
    const err = params.get("error");
    if (err) {
      setError(err);
      return;
    }
    if (!loginCode) {
      setError("Missing login code. Return to sign in and try again.");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.post("/auth/oauth/login-code", { code: loginCode });
        if (cancelled) return;
        setSession(data.token, data.user);
        const path = await getPostLoginPath();
        if (!cancelled) navigate(path, { replace: true });
      } catch (e) {
        if (!cancelled) setError(getApiErrorMessage(e, "Sign-in failed"));
      }
    })();
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
    <div className="min-h-screen flex items-center justify-center text-th-muted text-sm">
      Completing sign-in…
    </div>
  );
}
