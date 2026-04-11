import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth.jsx";
import RenewalReminders from "./RenewalReminders.jsx";
import PrescriptionReminders from "./PrescriptionReminders.jsx";
import NotificationBell from "./NotificationBell.jsx";
import AppVersionStamp from "./AppVersionStamp.jsx";

const linkClass = ({ isActive }) =>
  [
    "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
    isActive
      ? "bg-emerald-500/20 text-emerald-300"
      : "text-th-subtle hover:bg-th-surface-alt hover:text-th-secondary",
  ].join(" ");

/** Text before `@`; if that segment contains `.`, use only the part before the first `.`. */
function avatarLabelFromEmail(email) {
  if (!email || typeof email !== "string") return "Me";
  const at = email.indexOf("@");
  const local = (at >= 0 ? email.slice(0, at) : email).trim();
  if (!local) return "Me";
  const dot = local.indexOf(".");
  const base = dot >= 0 ? local.slice(0, dot).trim() : local;
  return base || "Me";
}

function MenuIcon({ open }) {
  return (
    <svg
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden
    >
      {open ? (
        <>
          <path d="M6 6l12 12M18 6L6 18" />
        </>
      ) : (
        <>
          <path d="M4 7h16M4 12h16M4 17h16" />
        </>
      )}
    </svg>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const avatarFallbackLabel = avatarLabelFromEmail(user?.email);
  const [renewalChip, setRenewalChip] = useState(null);
  /** When false, RenewalReminders hides institution tables + total (header + help may remain). */
  const [renewalTablesExpanded, setRenewalTablesExpanded] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const accountMenuRef = useRef(null);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const onChange = () => {
      if (mq.matches) setMobileNavOpen(false);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  function closeAccountMenu() {
    accountMenuRef.current?.removeAttribute("open");
  }

  function handleRenewalBadgeClick(e) {
    e.preventDefault();
    e.stopPropagation();
    if (!renewalChip) return;
    if (renewalChip.allDismissed) {
      renewalChip.onExpand();
    } else {
      renewalChip.onToggleTables();
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-th-border bg-th-surface/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <button
                type="button"
                className="md:hidden inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-th-subtle hover:bg-th-surface-alt hover:text-th-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
                onClick={() => setMobileNavOpen((o) => !o)}
                aria-expanded={mobileNavOpen}
                aria-controls="layout-primary-nav"
                aria-label={mobileNavOpen ? "Close menu" : "Open menu"}
              >
                <MenuIcon open={mobileNavOpen} />
              </button>
              <span className="text-lg font-semibold tracking-tight text-white truncate">
                Expense Tracker
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm text-th-subtle justify-end shrink-0">
              <NotificationBell />
              <details
                ref={accountMenuRef}
                className="relative group"
              >
                <summary
                  className="list-none cursor-pointer flex items-center rounded-lg hover:bg-th-surface-alt/80 px-1 py-0.5 -mx-1 [&::-webkit-details-marker]:hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
                  aria-label={
                    renewalChip
                      ? `Account menu, ${renewalChip.count} upcoming expenses`
                      : "Account menu"
                  }
                  aria-haspopup="menu"
                >
                <span className="inline-flex items-center gap-1.5 flex-shrink-0">
                  {user?.avatar_url ? (
                    <span className="w-8 h-8 rounded-full bg-th-surface-alt border border-th-border-bright overflow-hidden flex-shrink-0 flex items-center justify-center">
                      <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                    </span>
                  ) : (
                    <span
                      className="inline-flex items-center justify-center rounded-full bg-th-surface-alt border border-th-border-bright px-2 py-1.5 min-h-[2rem] flex-shrink-0 text-[10px] text-th-muted leading-tight whitespace-nowrap"
                      title={user?.email ?? undefined}
                    >
                      {avatarFallbackLabel}
                    </span>
                  )}
                  {renewalChip ? (
                    <button
                      type="button"
                      onClick={handleRenewalBadgeClick}
                      className="min-h-[1.125rem] min-w-[1.125rem] px-1 rounded-full border border-amber-600/80 bg-amber-950 text-[10px] font-semibold leading-none text-amber-100 inline-flex items-center justify-center tabular-nums shadow-sm hover:bg-amber-900/90 hover:border-amber-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/70"
                      title={
                        renewalChip.allDismissed
                          ? `Show ${renewalChip.count} upcoming expenses`
                          : renewalChip.tablesExpanded
                            ? `Hide upcoming expenses table (${renewalChip.count})`
                            : `Show upcoming expenses table (${renewalChip.count})`
                      }
                      aria-expanded={renewalChip.allDismissed ? undefined : renewalChip.tablesExpanded}
                      aria-label={
                        renewalChip.allDismissed
                          ? `Show upcoming expenses, ${renewalChip.count} items`
                          : renewalChip.tablesExpanded
                            ? `Hide upcoming expenses table, ${renewalChip.count} items`
                            : `Show upcoming expenses table, ${renewalChip.count} items`
                      }
                    >
                      {renewalChip.count}
                    </button>
                  ) : null}
                </span>
                </summary>
                <div
                  className="absolute right-0 top-full mt-1 py-1 min-w-[12rem] rounded-lg border border-th-border-bright bg-th-surface shadow-xl z-50"
                  role="menu"
                >
                  <NavLink
                  to="/profile"
                  role="menuitem"
                  className={({ isActive }) =>
                    [
                      "block w-full text-left px-3 py-2 text-sm hover:bg-th-surface-alt",
                      isActive ? "text-emerald-300 bg-th-surface-alt/40" : "text-th-secondary",
                    ].join(" ")
                  }
                  onClick={closeAccountMenu}
                >
                  Profile
                </NavLink>
                {renewalChip ? (
                  <button
                    type="button"
                    role="menuitem"
                    className="w-full text-left px-3 py-2 text-sm text-amber-100 hover:bg-th-surface-alt border-t border-th-border-bright"
                    onClick={() => {
                      if (renewalChip.allDismissed) renewalChip.onExpand();
                      else renewalChip.onShowTables();
                      closeAccountMenu();
                    }}
                  >
                    Upcoming expenses
                  </button>
                ) : null}
                <button
                  type="button"
                  role="menuitem"
                  className="w-full text-left px-3 py-2 text-sm text-th-secondary hover:bg-th-surface-alt border-t border-th-border-bright"
                  onClick={() => {
                    closeAccountMenu();
                    logout();
                  }}
                >
                  Sign out
                </button>
              </div>
            </details>
            </div>
          </div>

          <nav
            id="layout-primary-nav"
            className={[
              "flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2 max-md:pl-11 md:pl-0",
              mobileNavOpen ? "flex" : "max-md:hidden",
            ].join(" ")}
            aria-label="Primary"
          >
            <NavLink
              to="/budget"
              className={linkClass}
              onClick={() => setMobileNavOpen(false)}
            >
              Income
            </NavLink>
            <NavLink
              to="/expenses/list"
              className={linkClass}
              onClick={() => setMobileNavOpen(false)}
            >
              Expenses
            </NavLink>
          </nav>
        </div>
      </header>
      <main className="flex-1 min-w-0 max-w-7xl w-full mx-auto px-4 py-6">
        <RenewalReminders
          tablesExpanded={renewalTablesExpanded}
          onTablesExpandedChange={setRenewalTablesExpanded}
          onRenewalChipChange={setRenewalChip}
        />
        <PrescriptionReminders />
        <Outlet />
      </main>
      <footer className="border-t border-th-border-bright/40 py-2 mt-auto shrink-0">
        <div className="max-w-7xl w-full mx-auto px-4 flex justify-end">
          <AppVersionStamp className="text-[10px] text-th-muted tabular-nums" />
        </div>
      </footer>
    </div>
  );
}
