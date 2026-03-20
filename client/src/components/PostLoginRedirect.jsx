import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { getPostLoginPath } from "../postLoginLanding.js";

/**
 * Resolves /expenses vs /expenses/list after auth (any saved expense → list).
 */
export default function PostLoginRedirect() {
  const [path, setPath] = useState(null);

  useEffect(() => {
    let cancelled = false;
    getPostLoginPath().then((p) => {
      if (!cancelled) setPath(p);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (path === null) {
    return (
      <div className="flex min-h-[30vh] items-center justify-center text-sm text-slate-500">
        Loading…
      </div>
    );
  }
  return <Navigate to={path} replace />;
}
