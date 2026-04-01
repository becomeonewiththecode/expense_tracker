import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Per-row actions as a compact dropdown (Projection / Edit / Delete, etc.).
 * Menu is portaled to `document.body` with fixed positioning so parent `overflow` does not clip it.
 * @param {{ align?: "left" | "right", direction?: "auto" | "up" | "down", label?: string, items: Array<{ key: string, label: string, onClick: () => void, className?: string, disabled?: boolean, hidden?: boolean, title?: string }> }} props
 */
export default function RowActionsMenu({ align = "right", direction = "auto", label = "Actions", items }) {
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
    const viewportPadding = 8;
    const menuEl = menuRef.current;
    const menuWidth = menuEl?.offsetWidth ?? 168;
    const availableBelow = window.innerHeight - rect.bottom - viewportPadding;
    const availableAbove = rect.top - viewportPadding;
    const openUp =
      direction === "up"
        ? true
        : direction === "down"
          ? false
          : availableBelow < 180 && availableAbove > availableBelow;
    const leftForAlignRight = rect.right - menuWidth;
    const unclampedLeft = align === "right" ? leftForAlignRight : rect.left;
    const left = Math.min(
      window.innerWidth - viewportPadding - menuWidth,
      Math.max(viewportPadding, unclampedLeft)
    );
    setMenuStyle({
      position: "fixed",
      ...(openUp
        ? { bottom: Math.max(viewportPadding, window.innerHeight - rect.top + gap) }
        : { top: Math.max(viewportPadding, rect.bottom + gap) }),
      left,
      minWidth: "10.5rem",
      maxHeight: "min(18rem, calc(100vh - 1rem))",
      overflowY: "auto",
      zIndex: 200,
    });
  }, [align, direction]);

  useLayoutEffect(() => {
    if (!open) {
      setMenuStyle(null);
      return;
    }
    updatePosition();
    const raf = window.requestAnimationFrame(updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.cancelAnimationFrame(raf);
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
      className="rounded-lg border border-th-border-bright bg-th-base py-1 shadow-xl"
    >
      {visible.map((item) => (
        <button
          key={item.key}
          type="button"
          role="menuitem"
          title={item.title}
          disabled={item.disabled}
          className={`block w-full text-left px-3 py-2 text-xs hover:bg-th-surface-alt disabled:opacity-50 disabled:cursor-not-allowed ${item.className ?? "text-th-secondary"}`}
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
        className="rounded-md border border-th-border-bright bg-th-surface/90 hover:bg-th-surface-alt text-th-secondary text-xs font-medium px-2.5 py-1"
      >
        {label}
        <span className="ml-1 text-th-muted" aria-hidden>
          ▾
        </span>
      </button>
      {typeof document !== "undefined" && menuPanel ? createPortal(menuPanel, document.body) : null}
    </div>
  );
}
