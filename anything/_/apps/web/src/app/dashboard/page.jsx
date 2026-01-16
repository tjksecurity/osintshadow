"use client";

import { useState, useEffect, useRef } from "react";
import useUser from "@/utils/useUser";
import {
  Shield,
  Search,
  Bell,
  User,
  Menu,
  X,
  LayoutDashboard,
  FileBarChart,
  Map,
  CreditCard,
  Settings,
  Plus,
  TrendingUp,
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  XCircle,
  Sparkles,
} from "lucide-react";
import BrandLogo from "@/components/BrandLogo";

export default function Dashboard() {
  const { data: user, loading } = useUser();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [investigations, setInvestigations] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    completed: 0,
    processing: 0,
    failed: 0,
  });

  // NEW: lightweight polling so the dashboard feels "live"
  const pollRef = useRef({ invTimer: null, monitoringTimer: null });

  // NEW: keep admin gating consistent with /administration and backend admin checks
  const isAdminEmail =
    (user?.email || "").toLowerCase() === "glossontravis@gmail.com";
  const isAdmin = user?.role === "admin" || isAdminEmail;

  useEffect(() => {
    if (user) {
      fetchInvestigations();
    }
  }, [user]);

  // NEW: auto-refresh the investigations list while there is work in progress.
  useEffect(() => {
    if (!user) return;

    const clear = () => {
      if (pollRef.current.invTimer) {
        clearInterval(pollRef.current.invTimer);
        pollRef.current.invTimer = null;
      }
    };

    clear();

    pollRef.current.invTimer = setInterval(() => {
      // If the tab is hidden, don't spam requests.
      if (typeof document !== "undefined" && document.hidden) {
        return;
      }
      fetchInvestigations();
    }, 5000);

    return () => clear();
  }, [user]);

  // NEW: drive "real-time social monitoring" while a user is on the dashboard.
  // (Without cron jobs, this is the safest way to keep monitoring running.)
  useEffect(() => {
    if (!user) return;

    const clear = () => {
      if (pollRef.current.monitoringTimer) {
        clearInterval(pollRef.current.monitoringTimer);
        pollRef.current.monitoringTimer = null;
      }
    };

    clear();

    const runMonitoringTick = async () => {
      try {
        // best-effort: do not block UI, ignore failures
        await fetch("/api/social-monitoring/tick", {
          method: "POST",
          headers: { Accept: "application/json" },
        });
      } catch (e) {
        // ignore
      }
    };

    // Run once on load, then periodically.
    runMonitoringTick();

    pollRef.current.monitoringTimer = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) {
        return;
      }
      runMonitoringTick();
    }, 20000);

    return () => clear();
  }, [user]);

  // Redirect must be done in an effect to avoid SSR window access
  useEffect(() => {
    if (!loading && !user) {
      window.location.href = "/account/signin";
    }
  }, [loading, user]);

  const fetchInvestigations = async () => {
    try {
      const response = await fetch("/api/investigations?limit=10", {
        headers: {
          Accept: "application/json",
        },
      });

      if (response.status === 401) {
        window.location.href = `/account/signin?callbackUrl=${encodeURIComponent(
          window.location.pathname,
        )}`;
        return;
      }

      if (response.ok) {
        const data = await response.json();
        const items = data?.investigations || [];
        setInvestigations(items);

        // Calculate stats
        const total = items.length;
        const completed = items.filter((i) => i.status === "completed").length;
        const processing = items.filter(
          (i) => i.status === "processing",
        ).length;
        const failed = items.filter((i) => i.status === "failed").length;

        setStats({ total, completed, processing, failed });
      }
    } catch (error) {
      console.error("Error fetching investigations:", error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#263043] flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  // Remove direct window usage during render
  // if (!user) {
  //   window.location.href = "/account/signin";
  //   return null;
  // }

  const getStatusIcon = (status) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="text-green-400" size={16} />;
      case "processing":
        return <Clock className="text-yellow-400" size={16} />;
      case "failed":
        return <XCircle className="text-red-400" size={16} />;
      default:
        return <Clock className="text-slate-400" size={16} />;
    }
  };

  const getRiskColor = (riskScore) => {
    if (riskScore >= 70) return "text-red-400";
    if (riskScore >= 40) return "text-yellow-400";
    return "text-green-400";
  };

  return (
    <div className="flex min-h-screen text-white font-inter bg-[#263043]">
      {/* Sidebar Navigation */}
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
          <li className="flex items-center gap-3 py-2 px-6 bg-[#303B52] border-l-2 border-[#00D1FF] text-white">
            <LayoutDashboard size={18} />
            <span>Dashboard</span>
          </li>
          <li>
            <a
              href="/investigations/new"
              className="flex items-center gap-3 py-2 px-6 hover:bg-[#303B52] text-slate-400 hover:text-white transition-colors"
            >
              <Plus size={18} />
              <span>New Investigation</span>
            </a>
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
              href="/ai/chat"
              className="flex items-center gap-3 py-2 px-6 hover:bg-[#303B52] text-slate-400 hover:text-white transition-colors"
            >
              <Sparkles size={18} />
              <span>AI Chat</span>
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
              Admin Portal
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

      {/* Main Content Wrapper */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Application Bar */}
        <nav className="w-full h-14 px-6 flex items-center justify-between border-b border-[#37425B] bg-[#263043]">
          <div className="flex items-center gap-4">
            <Menu
              className="md:hidden cursor-pointer"
              size={24}
              onClick={() => setSidebarOpen(!sidebarOpen)}
            />
            <div className="hidden sm:flex relative w-64">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                size={16}
              />
              <input
                className="w-full rounded-full bg-transparent text-sm placeholder-slate-500 pl-9 pr-3 py-1.5 border border-[#37425B] focus:ring-0 focus:border-[#00D1FF] focus:outline-none"
                placeholder="Search investigations..."
              />
            </div>
          </div>

          <div className="flex items-center gap-6">
            <Bell
              className="text-slate-400 hover:text-white transition cursor-pointer"
              strokeWidth={1.5}
              size={20}
            />
            <a
              href="/ai/chat"
              className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 border border-[#37425B] rounded hover:bg-[#37425B] text-slate-200 text-sm transition-colors"
            >
              <Sparkles size={16} />
              AI Chat
            </a>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center">
                <User size={16} />
              </div>
              <span className="text-sm font-medium">
                {user?.name || user?.email}
              </span>
            </div>
          </div>
        </nav>

        {/* Main Content Area */}
        <section className="flex-1 p-6 space-y-6 overflow-auto">
          {/* Page Header */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-center gap-3">
              <LayoutDashboard className="text-slate-400" size={24} />
              <h1 className="text-lg font-semibold">Dashboard</h1>
            </div>
            <div className="flex items-center gap-3">
              <a
                href="/ai/chat"
                className="flex items-center gap-2 px-4 py-2 border border-[#37425B] rounded-lg hover:bg-[#37425B] transition-colors font-medium"
              >
                <Sparkles size={16} />
                <span>AI Chat</span>
              </a>
              <a
                href="/investigations/new"
                className="flex items-center gap-2 px-4 py-2 bg-[#00D1FF] text-[#263043] rounded-lg hover:bg-[#00B8E6] transition-colors font-medium"
              >
                <Plus size={16} />
                <span>New Investigation</span>
              </a>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-[#2D384E] rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">Credits Remaining</p>
                  <p className="text-2xl font-bold text-white">
                    {user?.monthly_remaining || 0}
                  </p>
                </div>
                <div className="w-12 h-12 bg-[#00D1FF]/10 rounded-lg flex items-center justify-center">
                  <CreditCard className="text-[#00D1FF]" size={24} />
                </div>
              </div>
            </div>

            <div className="bg-[#2D384E] rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">Total Investigations</p>
                  <p className="text-2xl font-bold text-white">{stats.total}</p>
                </div>
                <div className="w-12 h-12 bg-blue-500/10 rounded-lg flex items-center justify-center">
                  <FileBarChart className="text-blue-400" size={24} />
                </div>
              </div>
            </div>

            <div className="bg-[#2D384E] rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">Completed</p>
                  <p className="text-2xl font-bold text-white">
                    {stats.completed}
                  </p>
                </div>
                <div className="w-12 h-12 bg-green-500/10 rounded-lg flex items-center justify-center">
                  <CheckCircle className="text-green-400" size={24} />
                </div>
              </div>
            </div>

            <div className="bg-[#2D384E] rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">Processing</p>
                  <p className="text-2xl font-bold text-white">
                    {stats.processing}
                  </p>
                </div>
                <div className="w-12 h-12 bg-yellow-500/10 rounded-lg flex items-center justify-center">
                  <Clock className="text-yellow-400" size={24} />
                </div>
              </div>
            </div>
          </div>

          {/* Recent Investigations */}
          <div className="bg-[#2D384E] rounded-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold">Recent Investigations</h2>
              <a
                href="/investigations"
                className="text-[#00D1FF] hover:underline text-sm"
              >
                View All
              </a>
            </div>

            {investigations.length === 0 ? (
              <div className="text-center py-12">
                <FileBarChart
                  className="mx-auto text-slate-400 mb-4"
                  size={48}
                />
                <p className="text-slate-400 mb-4">No investigations yet</p>
                <a
                  href="/investigations/new"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-[#00D1FF] text-[#263043] rounded-lg hover:bg-[#00B8E6] transition-colors font-medium"
                >
                  <Plus size={16} />
                  Start Your First Investigation
                </a>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-slate-400 border-b border-[#37425B]">
                    <tr>
                      <th className="font-medium py-3 pr-6 text-left">
                        Target
                      </th>
                      <th className="font-medium py-3 px-6 text-left">Type</th>
                      <th className="font-medium py-3 px-6 text-left">
                        Status
                      </th>
                      <th className="font-medium py-3 px-6 text-left">
                        Risk Score
                      </th>
                      <th className="font-medium py-3 px-6 text-left">
                        Created
                      </th>
                      <th className="font-medium py-3 pl-6 text-left">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#37425B]">
                    {investigations.map((investigation) => (
                      <tr
                        key={investigation.id}
                        className="hover:bg-[#303B52]/40"
                      >
                        <td className="py-3 pr-6 font-medium">
                          {investigation.target_value}
                        </td>
                        <td className="py-3 px-6 capitalize">
                          {investigation.target_type}
                        </td>
                        <td className="py-3 px-6">
                          <div className="flex items-center gap-2">
                            {getStatusIcon(investigation.status)}
                            <span className="capitalize">
                              {investigation.status}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-6">
                          {investigation.risk_score ? (
                            <span
                              className={getRiskColor(investigation.risk_score)}
                            >
                              {investigation.risk_score}/100
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="py-3 px-6">
                          {new Date(
                            investigation.created_at,
                          ).toLocaleDateString()}
                        </td>
                        <td className="py-3 pl-6">
                          <a
                            href={`/investigations/${investigation.id}`}
                            className="text-[#00D1FF] hover:underline"
                          >
                            View
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Overlay for mobile sidebar */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        ></div>
      )}
    </div>
  );
}
