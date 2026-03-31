import { useEffect, useRef, useState } from "react";

/**
 * Per-row actions as a compact dropdown (Projection / Edit / Delete, etc.).
 * @param {{ align?: "left" | "right", label?: string, items: Array<{ key: string, label: string, onClick: () => void, className?: string, disabled?: boolean, hidden?: boolean, title?: string }> }} props
 */
export default function RowActionsMenu({ align = "right", label = "Actions", items }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  const visible = (items || []).filter((i) => !i.hidden);

  useEffect(() => {
    if (!open) return;
    function onKey(e) {
      if (e.key === "Escape") setOpen(false);
    }
    function onDoc(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDoc);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDoc);
    };
  }, [open]);

  if (visible.length === 0) return null;

  return (
    <div className="relative inline-block text-left" ref={rootRef}>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((o) => !o)}
        className="rounded-md border border-slate-600 bg-slate-900/90 hover:bg-slate-800 text-slate-200 text-xs font-medium px-2.5 py-1"
      >
        {label}
        <span className="ml-1 text-slate-500" aria-hidden>
          ▾
        </span>
      </button>
      {open ? (
        <div
          role="menu"
          className={`absolute z-40 mt-1 min-w-[10.5rem] rounded-lg border border-slate-700 bg-slate-950 py-1 shadow-xl ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          {visible.map((item) => (
            <button
              key={item.key}
              type="button"
              role="menuitem"
              title={item.title}
              disabled={item.disabled}
              className={`block w-full text-left px-3 py-2 text-xs hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed ${item.className ?? "text-slate-200"}`}
              onClick={() => {
                setOpen(false);
                item.onClick();
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
