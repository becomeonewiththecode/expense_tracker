import { useRef, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth.jsx";
import RenewalReminders from "./RenewalReminders.jsx";

const linkClass = ({ isActive }) =>
  [
    "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
    isActive
      ? "bg-emerald-500/20 text-emerald-300"
      : "text-slate-400 hover:bg-slate-800 hover:text-slate-200",
  ].join(" ");

export default function Layout() {
  const { user, logout } = useAuth();
  const [renewalChip, setRenewalChip] = useState(null);
  const accountMenuRef = useRef(null);

  function closeAccountMenu() {
    accountMenuRef.current?.removeAttribute("open");
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <span className="text-lg font-semibold tracking-tight text-white">
            Expense Tracker
          </span>
          <nav className="flex items-center gap-1 sm:gap-2">
            <NavLink to="/expenses" end className={linkClass}>
              Import
            </NavLink>
            <NavLink to="/expenses/list" className={linkClass}>
              Your expenses
            </NavLink>
            <NavLink to="/reports" className={linkClass}>
              Reports
            </NavLink>
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
                    ? `Account menu, ${renewalChip.count} upcoming renewals`
                    : "Account menu"
                }
                aria-haspopup="menu"
              >
                <span className="relative inline-flex">
                  <span className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 overflow-hidden flex-shrink-0 flex items-center justify-center">
                    {user?.avatar_url ? (
                      <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-[10px] text-slate-500">Me</span>
                    )}
                  </span>
                  {renewalChip ? (
                    <span
                      className="absolute -top-0.5 -right-0.5 min-w-[1.125rem] h-[1.125rem] px-0.5 rounded-full border border-amber-600/80 bg-amber-950 text-[10px] font-semibold leading-none text-amber-100 flex items-center justify-center tabular-nums shadow-sm"
                      title={`${renewalChip.count} upcoming renewals`}
                      aria-hidden
                    >
                      {renewalChip.count}
                    </span>
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
                      renewalChip.onExpand();
                      closeAccountMenu();
                    }}
                  >
                    Upcoming renewals
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
        <RenewalReminders onRenewalChipChange={setRenewalChip} />
        <Outlet />
      </main>
    </div>
  );
}
