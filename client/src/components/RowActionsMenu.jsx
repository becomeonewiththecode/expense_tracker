import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Per-row actions as a compact dropdown (Projection / Edit / Delete, etc.).
 * Menu is portaled to `document.body` with fixed positioning so parent `overflow` does not clip it.
 * @param {{ align?: "left" | "right", label?: string, items: Array<{ key: string, label: string, onClick: () => void, className?: string, disabled?: boolean, hidden?: boolean, title?: string }> }} props
 */
export default function RowActionsMenu({ align = "right", label = "Actions", items }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const [menuStyle, setMenuStyle] = useState(null);

  const visible = (items || []).filter((i) => !i.hidden);

  const updatePosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const gap = 4;
    setMenuStyle({
      position: "fixed",
      top: rect.bottom + gap,
      ...(align === "right"
        ? { right: window.innerWidth - rect.right }
        : { left: rect.left }),
      minWidth: "10.5rem",
      zIndex: 100,
    });
  }, [align]);

  useLayoutEffect(() => {
    if (!open) {
      setMenuStyle(null);
      return;
    }
    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    function onKey(e) {
      if (e.key === "Escape") setOpen(false);
    }
    function onDoc(e) {
      const t = e.target;
      if (triggerRef.current?.contains(t)) return;
      if (menuRef.current?.contains(t)) return;
      setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDoc);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDoc);
    };
  }, [open]);

  if (visible.length === 0) return null;

  const menuPanel = open && menuStyle && (
    <div
      ref={menuRef}
      role="menu"
      style={menuStyle}
      className="rounded-lg border border-slate-700 bg-slate-950 py-1 shadow-xl"
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
  );

  return (
    <div className="relative inline-block text-left" ref={triggerRef}>
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
      {typeof document !== "undefined" && menuPanel ? createPortal(menuPanel, document.body) : null}
    </div>
  );
}
