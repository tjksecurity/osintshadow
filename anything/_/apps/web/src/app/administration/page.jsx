"use client";

import { useEffect, useMemo, useState } from "react";
import useUser from "@/utils/useUser";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Shield,
  Search,
  Bell,
  User as UserIcon,
  Menu,
  X,
  LayoutDashboard,
  FileBarChart,
  Map,
  CreditCard,
  Settings,
  Activity,
  RefreshCw,
  Mail,
  Crown,
} from "lucide-react";
import BrandLogo from "@/components/BrandLogo";

export default function AdministrationPage() {
  const { data: user, loading } = useUser();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isAdminEmail =
    (user?.email || "").toLowerCase() === "glossontravis@gmail.com";
  const isAdmin = user?.role === "admin" || isAdminEmail;

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
      window.location.href = "/dashboard";
    }
  }, [user, isAdmin, loading]);

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

        {(user?.role === "admin" || isAdmin) && (
          <>
            <hr className="border-t border-[#37425B] my-4" />
            <div className="text-slate-200 text-xs uppercase px-6 mb-2">
              Administration
            </div>
            <ul className="space-y-1">
              <li>
                <a
                  href="/administration"
                  className="flex items-center gap-3 py-2 px-6 bg-[#303B52] border-l-2 border-[#00D1FF] text-white"
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
                placeholder="Search logs..."
              />
            </div>
          </div>

          <div className="flex items-center gap-6">
            <Bell
              className="text-slate-400 hover:text-white transition cursor-pointer"
              strokeWidth={1.5}
              size={20}
            />
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center">
                <UserIcon size={16} />
              </div>
              <span className="text-sm font-medium">
                {user?.name || user?.email}
              </span>
            </div>
          </div>
        </nav>

        {/* Main Content Area */}
        <section className="flex-1 p-6 space-y-6 overflow-auto">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-semibold">Administration</h1>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Logs Panel */}
            <div className="lg:col-span-2 bg-[#2D384E] rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold">Recent Logs</h2>
                <LogsRefresh />
              </div>
              <LogsTable />
            </div>

            {/* User Tools Panel */}
            <div className="bg-[#2D384E] rounded-lg p-4">
              <h2 className="font-semibold mb-3">User Tools</h2>
              <PasswordResetTool />
              <hr className="border-[#37425B] my-4" />
              <MakeAdminTool />
              <hr className="border-[#37425B] my-4" />
              <GrantCreditsTool />
              <hr className="border-[#37425B] my-4" />
              <NormalizeEmailsTool />
              <hr className="border-[#37425B] my-4" />
              <WeeklyReportTool />
            </div>

            {/* AI Chat Logs Panel */}
            <div className="lg:col-span-2 bg-[#2D384E] rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold">AI Chat Logs</h2>
                <LogsRefreshAIChat />
              </div>
              <AIChatLogsTable />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function LogsRefresh() {
  const qc = useQueryClient();
  return (
    <button
      onClick={() => qc.invalidateQueries({ queryKey: ["admin_logs"] })}
      className="flex items-center gap-2 px-3 py-1.5 border border-[#37425B] rounded hover:bg-[#37425B] text-sm"
    >
      <RefreshCw size={14} /> Refresh
    </button>
  );
}

function LogsTable() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin_logs"],
    queryFn: async () => {
      const res = await fetch("/api/admin/logs?limit=100");
      if (!res.ok) throw new Error(`Failed to load logs: ${res.status}`);
      return res.json();
    },
  });

  if (isLoading) return <div className="text-slate-300">Loading logs...</div>;
  if (error) return <div className="text-red-400">{error.message}</div>;
  const logs = data?.logs || [];

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-slate-400 border-b border-[#37425B]">
          <tr>
            <th className="py-2 text-left">Time</th>
            <th className="py-2 text-left">Type</th>
            <th className="py-2 text-left">Message</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#37425B]">
          {logs.map((l) => (
            <tr key={l.id} className="hover:bg-[#303B52]/40">
              <td className="py-2 pr-4 whitespace-nowrap">
                {new Date(l.created_at).toLocaleString()}
              </td>
              <td className="py-2 pr-4 text-slate-300">{l.log_type}</td>
              <td className="py-2">
                <div className="text-slate-200">{l.message}</div>
                {l.metadata_json ? (
                  <div className="text-slate-400 text-xs mt-1 break-words">
                    {JSON.stringify(l.metadata_json)}
                  </div>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {logs.length === 0 && <div className="text-slate-400">No logs yet.</div>}
    </div>
  );
}

function LogsRefreshAIChat() {
  const qc = useQueryClient();
  return (
    <button
      onClick={() => qc.invalidateQueries({ queryKey: ["admin_logs_ai_chat"] })}
      className="flex items-center gap-2 px-3 py-1.5 border border-[#37425B] rounded hover:bg-[#37425B] text-sm"
    >
      <RefreshCw size={14} /> Refresh
    </button>
  );
}

function AIChatLogsTable() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin_logs_ai_chat"],
    queryFn: async () => {
      const res = await fetch("/api/admin/logs?limit=200&type=ai_chat");
      if (!res.ok)
        throw new Error(`Failed to load AI chat logs: ${res.status}`);
      return res.json();
    },
  });

  if (isLoading)
    return <div className="text-slate-300">Loading AI chat logs...</div>;
  if (error) return <div className="text-red-400">{error.message}</div>;
  const logs = data?.logs || [];

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-slate-400 border-b border-[#37425B]">
          <tr>
            <th className="py-2 text-left">Time</th>
            <th className="py-2 text-left">User</th>
            <th className="py-2 text-left">Action</th>
            <th className="py-2 text-left">Preview</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#37425B]">
          {logs.map((l) => {
            const m = l.metadata_json || {};
            const action = m.action || "event";
            return (
              <tr key={l.id} className="hover:bg-[#303B52]/40">
                <td className="py-2 pr-4 whitespace-nowrap">
                  {new Date(l.created_at).toLocaleString()}
                </td>
                <td className="py-2 pr-4 text-slate-300">{m.email || "-"}</td>
                <td className="py-2 pr-4 text-slate-300">{action}</td>
                <td className="py-2">
                  <div className="text-slate-200 break-words">
                    {m.content_preview || m.prompt || ""}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {logs.length === 0 && (
        <div className="text-slate-400">
          No AI chat usage in the recent entries.
        </div>
      )}
    </div>
  );
}

function PasswordResetTool() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");
  const [link, setLink] = useState("");
  const resetMut = useMutation({
    mutationFn: async (email) => {
      const res = await fetch("/api/auth/password/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Failed to trigger reset");
      }
      return data;
    },
    onSuccess: (data) => {
      setMsg("Reset email sent (if the account exists).");
      if (data?.resetUrl) setLink(data.resetUrl);
    },
    onError: (e) => {
      setMsg(e.message);
      setLink("");
    },
  });

  return (
    <div>
      <h3 className="text-sm font-semibold mb-2">Trigger password reset</h3>
      <div className="flex gap-2">
        <input
          placeholder="user@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="flex-1 bg-[#37425B] border border-[#37425B] rounded px-3 py-2 text-sm"
        />
        <button
          onClick={() => email && resetMut.mutate(email)}
          className="px-3 py-2 bg-[#00D1FF] text-[#263043] rounded text-sm"
          disabled={!email || resetMut.isLoading}
        >
          {resetMut.isLoading ? "Sending..." : "Send"}
        </button>
      </div>
      {msg && <div className="text-slate-300 text-xs mt-2">{msg}</div>}
      {link && (
        <div className="text-xs mt-2">
          <a href={link} className="text-[#00D1FF] underline break-all">
            Open reset link
          </a>
        </div>
      )}
    </div>
  );
}

function MakeAdminTool() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");
  const mut = useMutation({
    mutationFn: async ({ email }) => {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role: "admin" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Failed (${res.status})`);
      return data;
    },
    onSuccess: () => setMsg("User promoted to admin."),
    onError: (e) => setMsg(e.message),
  });

  return (
    <div>
      <h3 className="text-sm font-semibold mb-2">Promote to admin</h3>
      <div className="flex gap-2">
        <input
          placeholder="user@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="flex-1 bg-[#37425B] border border-[#37425B] rounded px-3 py-2 text-sm"
        />
        <button
          onClick={() => email && mut.mutate({ email })}
          className="px-3 py-2 bg-[#00D1FF] text-[#263043] rounded text-sm flex items-center gap-1"
          disabled={!email || mut.isLoading}
        >
          <Crown size={14} /> {mut.isLoading ? "Promoting..." : "Promote"}
        </button>
      </div>
      {msg && <div className="text-slate-300 text-xs mt-2">{msg}</div>}
    </div>
  );
}

function GrantCreditsTool() {
  const [email, setEmail] = useState("");
  const [amount, setAmount] = useState(100000);
  const [msg, setMsg] = useState("");
  const mut = useMutation({
    mutationFn: async ({ email, amount }) => {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          monthly_remaining: amount,
          subscription_plan: "pro",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Failed (${res.status})`);
      return data;
    },
    onSuccess: () => setMsg("Credits updated."),
    onError: (e) => setMsg(e.message),
  });

  return (
    <div>
      <h3 className="text-sm font-semibold mb-2">Grant credits</h3>
      <div className="flex gap-2">
        <input
          placeholder="user@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="flex-1 bg-[#37425B] border border-[#37425B] rounded px-3 py-2 text-sm"
        />
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(parseInt(e.target.value || "0", 10))}
          className="w-28 bg-[#37425B] border border-[#37425B] rounded px-3 py-2 text-sm"
        />
        <button
          onClick={() =>
            email && Number.isInteger(amount) && mut.mutate({ email, amount })
          }
          className="px-3 py-2 bg-[#00D1FF] text-[#263043] rounded text-sm"
          disabled={!email || !Number.isInteger(amount) || mut.isLoading}
        >
          {mut.isLoading ? "Saving..." : "Save"}
        </button>
      </div>
      {msg && <div className="text-slate-300 text-xs mt-2">{msg}</div>}
    </div>
  );
}

// ADD: Maintenance tool to normalize existing emails to lowercase
function NormalizeEmailsTool() {
  const [msg, setMsg] = useState("");
  const mut = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/maintenance/normalize-emails", {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Failed (${res.status})`);
      return data;
    },
    onSuccess: (data) => setMsg(`${data.updated} email(s) normalized`),
    onError: (e) => setMsg(e.message),
  });

  return (
    <div className="mt-4">
      <h3 className="text-sm font-semibold mb-2">Maintenance</h3>
      <button
        onClick={() => mut.mutate()}
        className="px-3 py-2 border border-[#37425B] rounded hover:bg-[#37425B] text-sm"
        disabled={mut.isLoading}
      >
        {mut.isLoading ? "Running..." : "Normalize all emails to lowercase"}
      </button>
      {msg && <div className="text-slate-300 text-xs mt-2">{msg}</div>}
    </div>
  );
}

// ADD: tool to send weekly AI chat report
function WeeklyReportTool() {
  const [msg, setMsg] = useState("");
  const [sentTo, setSentTo] = useState([]);
  const mut = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/ai-chat/weekly-report", {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Failed (${res.status})`);
      return data;
    },
    onSuccess: (data) => {
      if (data.sent) {
        setMsg("Weekly report email sent.");
      } else {
        setMsg(
          data.reason === "missing_resend_api_key"
            ? "Email provider not configured. Showing summary only."
            : `Email not sent (${data.reason || "unknown"}).`,
        );
      }
      setSentTo(data.recipients || []);
    },
    onError: (e) => setMsg(e.message),
  });

  return (
    <div>
      <h3 className="text-sm font-semibold mb-2">AI Chat Weekly Report</h3>
      <button
        onClick={() => mut.mutate()}
        className="px-3 py-2 border border-[#37425B] rounded hover:bg-[#37425B] text-sm"
        disabled={mut.isLoading}
      >
        {mut.isLoading ? "Sending..." : "Send report now"}
      </button>
      {msg && <div className="text-slate-300 text-xs mt-2">{msg}</div>}
      {sentTo.length > 0 && (
        <div className="text-slate-400 text-xs mt-1">
          To: {sentTo.join(", ")}
        </div>
      )}
    </div>
  );
}
