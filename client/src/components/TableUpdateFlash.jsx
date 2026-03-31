import { useEffect, useState } from "react";

export default function TableUpdateFlash({ token = 0, label = "Updated" }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!token) return undefined;
    setVisible(true);
    const t = window.setTimeout(() => setVisible(false), 1400);
    return () => window.clearTimeout(t);
  }, [token]);

  if (!visible) return null;

  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/50 bg-emerald-950/40 px-2 py-0.5 text-[11px] text-emerald-300">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
        className="h-3.5 w-3.5"
        aria-hidden
      >
        <path d="M11 21h-1l1-7H7l6-11h1l-1 7h4z" />
      </svg>
      <span>{label}</span>
    </span>
  );
}
