import { Search, Bell, User, Menu } from "lucide-react";

export function TopBar({ sidebarOpen, setSidebarOpen, user }) {
  return (
    <nav className="w-full h-14 px-6 flex items-center justify-between border-b border-[var(--st-line)] bg-[var(--st-bg)]">
      <div className="flex items-center gap-4">
        <Menu
          className="md:hidden cursor-pointer"
          size={24}
          onClick={() => setSidebarOpen(!sidebarOpen)}
        />
        <div className="hidden sm:flex relative w-64">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--st-muted)]"
            size={16}
          />
          <input
            className="w-full rounded-full bg-transparent text-sm placeholder-slate-500 pl-9 pr-3 py-1.5 border border-[var(--st-line)] focus:ring-0 focus:border-[var(--st-accent)] focus:outline-none"
            placeholder="Search investigations..."
          />
        </div>
      </div>

      <div className="flex items-center gap-6">
        <Bell
          className="text-[var(--st-muted)] hover:text-white transition cursor-pointer"
          strokeWidth={1.5}
          size={20}
        />
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[var(--st-elevated)] flex items-center justify-center">
            <User size={16} />
          </div>
          <span className="text-sm font-medium">
            {user?.name || user?.email}
          </span>
        </div>
      </div>
    </nav>
  );
}
