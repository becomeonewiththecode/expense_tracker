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
            <NavLink to="/profile" className={linkClass}>
              Profile
            </NavLink>
          </nav>
          <div className="flex items-center gap-3 text-sm text-slate-400">
            <NavLink
              to="/profile"
              className="flex items-center gap-2 min-w-0 rounded-lg hover:bg-slate-800/80 px-1 py-0.5 -mx-1"
              title="Profile"
            >
              <span className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 overflow-hidden flex-shrink-0 flex items-center justify-center">
                {user?.avatar_url ? (
                  <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-[10px] text-slate-500">Me</span>
                )}
              </span>
              <span className="hidden sm:inline truncate max-w-[12rem]">{user?.email}</span>
            </NavLink>
            <button
              type="button"
              onClick={logout}
              className="text-slate-300 hover:text-white underline-offset-2 hover:underline"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6">
        <RenewalReminders />
        <Outlet />
      </main>
    </div>
  );
}
