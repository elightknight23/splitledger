import { LayoutDashboard, LogOut } from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function AppShell() {
  const { user, logout } = useAuth();

  return (
    <div className="flex h-screen bg-surface">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 flex-col border-r-2 border-on-surface bg-surface p-4 md:flex">
        <div className="mb-10">
          <h1 className="font-headline text-xl font-bold uppercase tracking-tight text-primary">
            SplitLedger
          </h1>
          <p className="label-caps mt-1 text-on-surface-variant opacity-70">Shared Finance</p>
        </div>

        <nav className="flex-1 space-y-4">
          <NavLink
            to="/dashboard"
            className={({ isActive }) =>
              `flex items-center gap-3 p-3 font-body transition-all ${
                isActive
                  ? "translate-x-1 translate-y-1 border-2 border-on-surface bg-secondary-container font-bold text-on-secondary-container"
                  : "text-on-surface hover:translate-x-1 hover:translate-y-1"
              }`
            }
          >
            <LayoutDashboard className="h-5 w-5" />
            Dashboard
          </NavLink>
        </nav>

        <div className="mt-auto border-t-2 border-dashed border-on-surface/20 pt-4">
          <p className="truncate font-body font-bold text-on-surface">{user?.name}</p>
          <p className="label-caps mt-1 truncate text-[10px] text-on-surface-variant">
            {user?.email}
          </p>
          <button
            type="button"
            onClick={() => void logout()}
            className="hard-shadow-sm btn-press mt-4 flex w-full items-center justify-center gap-2 border-2 border-on-surface bg-surface-container-low px-3 py-2"
          >
            <LogOut className="h-4 w-4" />
            <span className="label-caps">Log_Out</span>
          </button>
        </div>
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile top bar — the sidebar is hidden below md */}
        <header className="flex items-center justify-between border-b-2 border-on-surface bg-surface px-4 py-3 md:hidden">
          <div>
            <h1 className="font-headline text-lg font-bold uppercase tracking-tight text-primary">
              SplitLedger
            </h1>
          </div>
          <button
            type="button"
            onClick={() => void logout()}
            className="flex items-center gap-2 border-2 border-on-surface bg-surface-container-low px-3 py-1.5"
          >
            <LogOut className="h-4 w-4" />
            <span className="label-caps text-[10px]">Log_Out</span>
          </button>
        </header>

        <main className="paper-bg flex-1 overflow-y-auto p-4 sm:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
