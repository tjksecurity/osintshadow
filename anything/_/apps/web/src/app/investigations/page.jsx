"use client";

import { useState, useEffect } from "react";
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
  Activity,
  CheckCircle,
  Clock,
  XCircle,
  Filter,
  Download,
  Trash2,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import BrandLogo from "@/components/BrandLogo";

export default function Investigations() {
  const { data: user, loading } = useUser();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [investigations, setInvestigations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    if (user) {
      fetchInvestigations();
    }
  }, [user]);

  useEffect(() => {
    if (!loading && !user) {
      window.location.href = "/account/signin";
    }
  }, [loading, user]);

  const fetchInvestigations = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      // Fetch all investigations (up to 1000) so the user can see their full history
      const response = await fetch("/api/investigations?limit=1000", {
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

      if (!response.ok) {
        let payload = null;
        try {
          payload = await response.json();
        } catch (_) {}
        const code = payload?.code || response.status;
        const message = payload?.error || `Request failed (${response.status})`;
        console.error("Investigations request failed:", {
          status: response.status,
          code,
          payload,
        });
        setLoadError(`${message}${code ? ` [${code}]` : ""}`);
        setInvestigations([]);
        return;
      }
      const data = await response.json();
      if (!data || !Array.isArray(data.investigations)) {
        console.warn("Unexpected investigations response shape", data);
        setInvestigations([]);
      } else {
        setInvestigations(data.investigations);
      }
    } catch (error) {
      console.error("Error fetching investigations:", error);
      setLoadError("Could not load investigations. Please try again.");
      setInvestigations([]);
    } finally {
      setIsLoading(false);
    }
  };

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

  const filteredInvestigations = investigations.filter((inv) => {
    const matchesStatus = filterStatus === "all" || inv.status === filterStatus;
    const matchesSearch =
      searchQuery === "" ||
      inv.target_value.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.target_type.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  if (loading || isLoading) {
    return (
      <div className="min-h-screen bg-[#263043] flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

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
          <li>
            <a
              href="/dashboard"
              className="flex items-center gap-3 py-2 px-6 hover:bg-[#303B52] text-slate-400 hover:text-white transition-colors"
            >
              <LayoutDashboard size={18} />
              <span>Dashboard</span>
            </a>
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
          <li className="flex items-center gap-3 py-2 px-6 bg-[#303B52] border-l-2 border-[#00D1FF] text-white">
            <FileBarChart size={18} />
            <span>Investigations</span>
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

        {(user?.role === "admin" ||
          (user?.email || "").toLowerCase() === "glossontravis@gmail.com") && (
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
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
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
              <FileBarChart className="text-slate-400" size={24} />
              <h1 className="text-lg font-semibold">All Investigations</h1>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={fetchInvestigations}
                className="flex items-center gap-2 px-4 py-2 border border-[#37425B] rounded-lg hover:bg-[#37425B] transition-colors font-medium"
              >
                <RefreshCw size={16} />
                <span>Refresh</span>
              </button>
              <a
                href="/investigations/new"
                className="flex items-center gap-2 px-4 py-2 bg-[#00D1FF] text-[#263043] rounded-lg hover:bg-[#00B8E6] transition-colors font-medium"
              >
                <Plus size={16} />
                <span>New Investigation</span>
              </a>
            </div>
          </div>

          {/* Error banner when load failed */}
          {loadError && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-300 rounded-md px-4 py-2">
              {loadError}
            </div>
          )}

          {/* Filters */}
          <div className="bg-[#2D384E] rounded-lg p-4">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <Filter className="text-slate-400" size={18} />
                <span className="text-sm font-medium">Filter by status:</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setFilterStatus("all")}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    filterStatus === "all"
                      ? "bg-[#00D1FF] text-[#263043]"
                      : "bg-[#37425B] text-slate-300 hover:bg-[#37425B]/80"
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setFilterStatus("completed")}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    filterStatus === "completed"
                      ? "bg-[#00D1FF] text-[#263043]"
                      : "bg-[#37425B] text-slate-300 hover:bg-[#37425B]/80"
                  }`}
                >
                  Completed
                </button>
                <button
                  onClick={() => setFilterStatus("processing")}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    filterStatus === "processing"
                      ? "bg-[#00D1FF] text-[#263043]"
                      : "bg-[#37425B] text-slate-300 hover:bg-[#37425B]/80"
                  }`}
                >
                  Processing
                </button>
                <button
                  onClick={() => setFilterStatus("failed")}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    filterStatus === "failed"
                      ? "bg-[#00D1FF] text-[#263043]"
                      : "bg-[#37425B] text-slate-300 hover:bg-[#37425B]/80"
                  }`}
                >
                  Failed
                </button>
              </div>
            </div>
          </div>

          {/* Investigations Table */}
          <div className="bg-[#2D384E] rounded-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold">
                {filteredInvestigations.length} Investigation
                {filteredInvestigations.length !== 1 ? "s" : ""}
              </h2>
            </div>

            {filteredInvestigations.length === 0 ? (
              <div className="text-center py-12">
                <FileBarChart
                  className="mx-auto text-slate-400 mb-4"
                  size={48}
                />
                <p className="text-slate-400 mb-4">
                  {searchQuery || filterStatus !== "all"
                    ? "No investigations match your filters"
                    : "No investigations yet"}
                </p>
                {!searchQuery && filterStatus === "all" && (
                  <a
                    href="/investigations/new"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-[#00D1FF] text-[#263043] rounded-lg hover:bg-[#00B8E6] transition-colors font-medium"
                  >
                    <Plus size={16} />
                    Start Your First Investigation
                  </a>
                )}
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
                      <th className="font-medium py-3 px-6 text-left">
                        Completed
                      </th>
                      <th className="font-medium py-3 pl-6 text-left">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#37425B]">
                    {filteredInvestigations.map((investigation) => (
                      <tr
                        key={investigation.id}
                        className="hover:bg-[#303B52]/40 cursor-pointer"
                        onClick={() => {
                          window.location.href = `/investigations/${investigation.id}`;
                        }}
                      >
                        <td className="py-3 pr-6 font-medium">
                          {investigation.target_value}
                        </td>
                        <td className="py-3 px-6 capitalize">
                          {investigation.target_type.replace("_", " ")}
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
                        <td className="py-3 px-6">
                          {investigation.completed_at ? (
                            new Date(
                              investigation.completed_at,
                            ).toLocaleDateString()
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="py-3 pl-6">
                          <a
                            href={`/investigations/${investigation.id}`}
                            className="text-[#00D1FF] hover:underline"
                            onClick={(e) => {
                              // prevent double navigation / accidental row handler interference
                              e.stopPropagation();
                            }}
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
