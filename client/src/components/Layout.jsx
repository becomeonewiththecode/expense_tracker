import { useRef, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../auth.jsx";
import RenewalReminders from "./RenewalReminders.jsx";
import PrescriptionReminders from "./PrescriptionReminders.jsx";

const linkClass = ({ isActive }) =>
  [
    "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
    isActive
      ? "bg-emerald-500/20 text-emerald-300"
      : "text-slate-400 hover:bg-slate-800 hover:text-slate-200",
  ].join(" ");

const listsDropdownItemClass = ({ isActive }) =>
  [
    "block w-full text-left px-3 py-2 text-sm transition-colors",
    isActive ? "text-emerald-300 bg-slate-800/50" : "text-slate-200 hover:bg-slate-800",
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

function ListsNavDropdown() {
  const { pathname } = useLocation();
  const listsMenuRef = useRef(null);
  const listsSectionActive =
    pathname === "/expenses/list" ||
    pathname === "/renewals" ||
    pathname === "/prescriptions" ||
    pathname === "/payment-plans" ||
    pathname === "/reports";

  function closeListsMenu() {
    listsMenuRef.current?.removeAttribute("open");
  }

  return (
    <details ref={listsMenuRef} className="relative group">
      <summary
        className={[
          "list-none cursor-pointer rounded-lg px-3 py-2 text-sm font-medium transition-colors flex items-center gap-1",
          listsSectionActive
            ? "bg-emerald-500/20 text-emerald-300"
            : "text-slate-400 hover:bg-slate-800 hover:text-slate-200",
          "[&::-webkit-details-marker]:hidden",
        ].join(" ")}
        aria-haspopup="menu"
      >
        Lists
        <span className="text-[0.65rem] opacity-80" aria-hidden>
          ▾
        </span>
      </summary>
      <div
        className="absolute left-0 top-full mt-1 py-1 min-w-[12rem] rounded-lg border border-slate-700 bg-slate-900 shadow-xl z-50"
        role="menu"
      >
        <NavLink
          to="/expenses/list"
          role="menuitem"
          className={listsDropdownItemClass}
          onClick={closeListsMenu}
        >
          Expenses
        </NavLink>
        <NavLink
          to="/renewals"
          role="menuitem"
          className={listsDropdownItemClass}
          onClick={closeListsMenu}
        >
          Renewals
        </NavLink>
        <NavLink
          to="/prescriptions"
          role="menuitem"
          className={listsDropdownItemClass}
          onClick={closeListsMenu}
        >
          Prescriptions
        </NavLink>
        <NavLink
          to="/payment-plans"
          role="menuitem"
          className={listsDropdownItemClass}
          onClick={closeListsMenu}
        >
          Payment Plan
        </NavLink>
        <NavLink
          to="/reports"
          role="menuitem"
          className={listsDropdownItemClass}
          onClick={closeListsMenu}
        >
          Reports
        </NavLink>
      </div>
    </details>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const avatarFallbackLabel = avatarLabelFromEmail(user?.email);
  const [renewalChip, setRenewalChip] = useState(null);
  /** When false, RenewalReminders hides institution tables + total (header + help may remain). */
  const [renewalTablesExpanded, setRenewalTablesExpanded] = useState(false);
  const accountMenuRef = useRef(null);

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
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <span className="text-lg font-semibold tracking-tight text-white">
            Expense Tracker
          </span>
          <nav className="flex flex-wrap items-center gap-1 sm:gap-2">
            <NavLink to="/expenses" end className={linkClass}>
              Import
            </NavLink>
            <div className="lg:hidden">
              <ListsNavDropdown />
            </div>
            <div className="hidden lg:flex items-center gap-1 sm:gap-2">
              <NavLink to="/expenses/list" className={linkClass}>
                Expenses
              </NavLink>
              <NavLink to="/renewals" className={linkClass}>
                Renewals
              </NavLink>
              <NavLink to="/prescriptions" className={linkClass}>
                Prescriptions
              </NavLink>
              <NavLink to="/payment-plans" className={linkClass}>
                Payment Plan
              </NavLink>
              <NavLink to="/reports" className={linkClass}>
                Reports
              </NavLink>
            </div>
          </nav>
          <div className="flex items-center text-sm text-slate-400 justify-end">
            <details
              ref={accountMenuRef}
              className="relative group"
            >
              <summary
                className="list-none cursor-pointer flex items-center rounded-lg hover:bg-slate-800/80 px-1 py-0.5 -mx-1 [&::-webkit-details-marker]:hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
                aria-label={
                  renewalChip
                    ? `Account menu, ${renewalChip.count} upcoming expenses`
                    : "Account menu"
                }
                aria-haspopup="menu"
              >
                <span className="inline-flex items-center gap-1.5 flex-shrink-0">
                  {user?.avatar_url ? (
                    <span className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 overflow-hidden flex-shrink-0 flex items-center justify-center">
                      <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                    </span>
                  ) : (
                    <span
                      className="inline-flex items-center justify-center rounded-full bg-slate-800 border border-slate-700 px-2 py-1.5 min-h-[2rem] flex-shrink-0 text-[10px] text-slate-500 leading-tight whitespace-nowrap"
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
                className="absolute right-0 top-full mt-1 py-1 min-w-[12rem] rounded-lg border border-slate-700 bg-slate-900 shadow-xl z-50"
                role="menu"
              >
                <NavLink
                  to="/profile"
                  role="menuitem"
                  className={({ isActive }) =>
                    [
                      "block w-full text-left px-3 py-2 text-sm hover:bg-slate-800",
                      isActive ? "text-emerald-300 bg-slate-800/40" : "text-slate-200",
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
                    className="w-full text-left px-3 py-2 text-sm text-amber-100 hover:bg-slate-800 border-t border-slate-700"
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
                  className="w-full text-left px-3 py-2 text-sm text-slate-200 hover:bg-slate-800 border-t border-slate-700"
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
      </header>
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6">
        <RenewalReminders
          tablesExpanded={renewalTablesExpanded}
          onTablesExpandedChange={setRenewalTablesExpanded}
          onRenewalChipChange={setRenewalChip}
        />
        <PrescriptionReminders />
        <Outlet />
      </main>
    </div>
  );
}
