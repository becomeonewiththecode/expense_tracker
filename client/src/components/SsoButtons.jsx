const PROVIDERS = [
  { id: "google", label: "Google (Gmail)" },
  { id: "github", label: "GitHub" },
  { id: "gitlab", label: "GitLab" },
  { id: "microsoft", label: "Microsoft 365" },
];

export default function SsoButtons({ className = "" }) {
  return (
    <div className={`space-y-3 ${className}`}>
      <p className="text-xs text-th-muted text-center">Or continue with</p>
      <div className="grid grid-cols-2 gap-2">
        {PROVIDERS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => {
              window.location.href = `/api/auth/oauth/${p.id}`;
            }}
            className="rounded-lg border border-th-border-bright bg-th-surface-alt/80 hover:bg-th-surface-alt text-th-secondary text-xs font-medium py-2 px-2 transition-colors"
          >
            {p.label}
          </button>
        ))}
      </div>
      <p className="text-[10px] text-th-muted text-center leading-relaxed">
        OAuth sign-in requires <code className="text-th-muted">OAUTH_*</code> client IDs in{" "}
        <code className="text-th-muted">server/.env</code>. Unconfigured providers return an error when clicked.
      </p>
    </div>
  );
}
