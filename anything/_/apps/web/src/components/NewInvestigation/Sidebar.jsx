import {
  LayoutDashboard,
  FileBarChart,
  Map,
  CreditCard,
  Settings,
  Plus,
  Activity,
  X,
} from "lucide-react";
import BrandLogo from "@/components/BrandLogo";

export function Sidebar({ sidebarOpen, setSidebarOpen, isAdmin }) {
  return (
    <aside
      className={`fixed md:static inset-y-0 left-0 z-50 w-[220px] bg-[#232D41] border-r border-[#37425B] transform transition-transform duration-300 ${
        sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      }`}
    >
      <div className="flex items-center gap-2 py-4 px-6">
        <BrandLogo className="h-5 w-auto" variant="onDark" />
        <div className="flex-1"></div>
        <X
          className="md:hidden text-slate-300 cursor-pointer"
          size={22}
          onClick={() => setSidebarOpen(false)}
        />
      </div>

      <ul className="space-y-1">
        <li>
          <a
            href="/dashboard"
            className="flex items-center gap-3 py-2 px-6 hover:bg-[#303B52] text-slate-400 hover:text-white transition-colors"
          >
            <LayoutDashboard size={18} />
            <span>Dashboard</span>
          </a>
        </li>
        <li className="flex items-center gap-3 py-2 px-6 bg-[#303B52] border-l-2 border-[#00D1FF] text-white">
          <Plus size={18} />
          <span>New Investigation</span>
        </li>
        <li>
          <a
            href="/investigations"
            className="flex items-center gap-3 py-2 px-6 hover:bg-[#303B52] text-slate-400 hover:text-white transition-colors"
          >
            <FileBarChart size={18} />
            <span>Investigations</span>
          </a>
        </li>
        <li>
          <a
            href="/map"
            className="flex items-center gap-3 py-2 px-6 hover:bg-[#303B52] text-slate-400 hover:text-white transition-colors"
          >
            <Map size={18} />
            <span>Global Map</span>
          </a>
        </li>
        <li>
          <a
            href="/billing"
            className="flex items-center gap-3 py-2 px-6 hover:bg-[#303B52] text-slate-400 hover:text-white transition-colors"
          >
            <CreditCard size={18} />
            <span>Billing</span>
          </a>
        </li>
        <li>
          <a
            href="/settings"
            className="flex items-center gap-3 py-2 px-6 hover:bg-[#303B52] text-slate-400 hover:text-white transition-colors"
          >
            <Settings size={18} />
            <span>Settings</span>
          </a>
        </li>
      </ul>

      {isAdmin && (
        <>
          <hr className="border-t border-[#37425B] my-4" />
          <div className="text-slate-400 text-xs uppercase px-6 mb-2">
            Administration
          </div>
          <ul className="space-y-1">
            <li>
              <a
                href="/administration"
                className="flex items-center gap-3 py-2 px-6 hover:bg-[#303B52] text-slate-400 hover:text-white transition-colors"
              >
                <Activity size={18} />
                <span>Administration</span>
              </a>
            </li>
          </ul>
        </>
      )}
    </aside>
  );
}
