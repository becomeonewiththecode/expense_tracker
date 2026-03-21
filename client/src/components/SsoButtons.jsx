const PROVIDERS = [
  { id: "google", label: "Google (Gmail)" },
  { id: "github", label: "GitHub" },
  { id: "gitlab", label: "GitLab" },
  { id: "microsoft", label: "Microsoft 365" },
];

export default function SsoButtons({ className = "" }) {
  return (
    <div className={`space-y-3 ${className}`}>
      <p className="text-xs text-slate-500 text-center">Or continue with</p>
      <div className="grid grid-cols-2 gap-2">
        {PROVIDERS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => {
              window.location.href = `/api/auth/oauth/${p.id}`;
            }}
            className="rounded-lg border border-slate-700 bg-slate-800/80 hover:bg-slate-800 text-slate-200 text-xs font-medium py-2 px-2 transition-colors"
          >
            {p.label}
          </button>
        ))}
      </div>
      <p className="text-[10px] text-slate-600 text-center leading-relaxed">
        OAuth sign-in requires <code className="text-slate-500">OAUTH_*</code> client IDs in{" "}
        <code className="text-slate-500">server/.env</code>. Unconfigured providers return an error when clicked.
      </p>
    </div>
  );
}
