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
  Sparkles,
  Eye,
  EyeOff,
  Save,
  LogOut,
} from "lucide-react";
import BrandLogo from "@/components/BrandLogo";

export default function SettingsPage() {
  const { data: user, loading, refetch } = useUser();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  // NEW: keep admin gating consistent with /administration and backend admin checks
  const isAdminEmail =
    (user?.email || "").toLowerCase() === "glossontravis@gmail.com";
  const isAdmin = user?.role === "admin" || isAdminEmail;

  // Profile settings
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  // Password change
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      window.location.href = "/account/signin";
    }
  }, [loading, user]);

  useEffect(() => {
    if (user) {
      setName(user.name || "");
      setEmail(user.email || "");
    }
  }, [user]);

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage({ type: "", text: "" });

    try {
      const response = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });

      if (!response.ok) {
        throw new Error("Failed to update profile");
      }

      await refetch();
      setMessage({ type: "success", text: "Profile updated successfully!" });
    } catch (error) {
      console.error(error);
      setMessage({ type: "error", text: "Failed to update profile" });
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage({ type: "", text: "" });

    if (newPassword !== confirmPassword) {
      setMessage({ type: "error", text: "New passwords do not match" });
      setSaving(false);
      return;
    }

    if (newPassword.length < 8) {
      setMessage({
        type: "error",
        text: "Password must be at least 8 characters",
      });
      setSaving(false);
      return;
    }

    try {
      const response = await fetch("/api/user/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to change password");
      }

      setMessage({ type: "success", text: "Password changed successfully!" });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      console.error(error);
      setMessage({
        type: "error",
        text: error.message || "Failed to change password",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    window.location.href = "/account/logout";
  };

  if (loading) {
    return (
      <div className="st-workspace min-h-screen bg-[var(--st-bg)] flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  return (
    <div className="st-workspace flex min-h-screen text-white font-inter bg-[var(--st-bg)]">
      {/* Sidebar Navigation */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-50 w-[220px] bg-[var(--st-inset)] border-r border-[var(--st-line)] transform transition-transform duration-300 ${
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
              className="flex items-center gap-3 py-2 px-6 hover:bg-[var(--st-elevated)] text-[var(--st-muted)] hover:text-white transition-colors"
            >
              <LayoutDashboard size={18} />
              <span>Dashboard</span>
            </a>
          </li>
          <li>
            <a
              href="/investigations/new"
              className="flex items-center gap-3 py-2 px-6 hover:bg-[var(--st-elevated)] text-[var(--st-muted)] hover:text-white transition-colors"
            >
              <Plus size={18} />
              <span>New Investigation</span>
            </a>
          </li>
          <li>
            <a
              href="/investigations"
              className="flex items-center gap-3 py-2 px-6 hover:bg-[var(--st-elevated)] text-[var(--st-muted)] hover:text-white transition-colors"
            >
              <FileBarChart size={18} />
              <span>Investigations</span>
            </a>
          </li>
          <li>
            <a
              href="/ai/chat"
              className="flex items-center gap-3 py-2 px-6 hover:bg-[var(--st-elevated)] text-[var(--st-muted)] hover:text-white transition-colors"
            >
              <Sparkles size={18} />
              <span>AI Chat</span>
            </a>
          </li>
          <li>
            <a
              href="/map"
              className="flex items-center gap-3 py-2 px-6 hover:bg-[var(--st-elevated)] text-[var(--st-muted)] hover:text-white transition-colors"
            >
              <Map size={18} />
              <span>Global Map</span>
            </a>
          </li>
          <li>
            <a
              href="/billing"
              className="flex items-center gap-3 py-2 px-6 hover:bg-[var(--st-elevated)] text-[var(--st-muted)] hover:text-white transition-colors"
            >
              <CreditCard size={18} />
              <span>Billing</span>
            </a>
          </li>
          <li className="flex items-center gap-3 py-2 px-6 bg-[var(--st-elevated)] border-l-2 border-[var(--st-accent)] text-white">
            <Settings size={18} />
            <span>Settings</span>
          </li>
        </ul>

        {isAdmin && (
          <>
            <hr className="border-t border-[var(--st-line)] my-4" />
            <div className="text-[var(--st-muted)] text-xs uppercase px-6 mb-2">
              Admin Portal
            </div>
            <ul className="space-y-1">
              <li>
                <a
                  href="/administration"
                  className="flex items-center gap-3 py-2 px-6 hover:bg-[var(--st-elevated)] text-[var(--st-muted)] hover:text-white transition-colors"
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
            <a
              href="/ai/chat"
              className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 border border-[var(--st-line)] rounded hover:bg-[var(--st-hover)] text-slate-200 text-sm transition-colors"
            >
              <Sparkles size={16} />
              AI Chat
            </a>
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

        {/* Main Content Area */}
        <section className="flex-1 p-6 space-y-6 overflow-auto">
          {/* Page Header */}
          <div className="flex items-center gap-3">
            <Settings className="text-[var(--st-muted)]" size={24} />
            <h1 className="text-lg font-semibold">Settings</h1>
          </div>

          {/* Message Display */}
          {message.text && (
            <div
              className={`rounded-lg p-4 ${
                message.type === "success"
                  ? "bg-green-500/10 border border-green-500/20 text-green-400"
                  : "bg-red-500/10 border border-red-500/20 text-red-400"
              }`}
            >
              {message.text}
            </div>
          )}

          {/* Profile Settings */}
          <div className="bg-[var(--st-panel)] rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-6">Profile Information</h2>
            <form onSubmit={handleProfileUpdate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3 bg-[var(--st-elevated)] border border-[var(--st-line)] rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-[var(--st-accent)] focus:ring-1 focus:ring-[var(--st-accent)]"
                  placeholder="Enter your name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  disabled
                  className="w-full px-4 py-3 bg-[var(--st-elevated)]/50 border border-[var(--st-line)] rounded-lg text-[var(--st-muted)] cursor-not-allowed"
                />
                <p className="mt-1 text-xs text-[var(--st-muted)]">
                  Email cannot be changed
                </p>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-[var(--st-accent)] text-[var(--st-bg)] rounded-lg hover:bg-[var(--st-accent-hover)] transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save size={16} />
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </form>
          </div>

          {/* Password Change */}
          <div className="bg-[var(--st-panel)] rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-6">Change Password</h2>
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Current Password
                </label>
                <div className="relative">
                  <input
                    type={showPasswords ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full px-4 py-3 bg-[var(--st-elevated)] border border-[var(--st-line)] rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-[var(--st-accent)] focus:ring-1 focus:ring-[var(--st-accent)] pr-12"
                    placeholder="Enter current password"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswords(!showPasswords)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--st-muted)] hover:text-white"
                  >
                    {showPasswords ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  New Password
                </label>
                <input
                  type={showPasswords ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-[var(--st-elevated)] border border-[var(--st-line)] rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-[var(--st-accent)] focus:ring-1 focus:ring-[var(--st-accent)]"
                  placeholder="Enter new password"
                  autoComplete="new-password"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Confirm New Password
                </label>
                <input
                  type={showPasswords ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-[var(--st-elevated)] border border-[var(--st-line)] rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-[var(--st-accent)] focus:ring-1 focus:ring-[var(--st-accent)]"
                  placeholder="Confirm new password"
                  autoComplete="new-password"
                />
              </div>

              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-[var(--st-accent)] text-[var(--st-bg)] rounded-lg hover:bg-[var(--st-accent-hover)] transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save size={16} />
                {saving ? "Changing..." : "Change Password"}
              </button>
            </form>
          </div>

          {/* Account Actions */}
          <div className="bg-[var(--st-panel)] rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-6">Account Actions</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Sign Out</p>
                  <p className="text-sm text-[var(--st-muted)]">
                    Sign out of your account
                  </p>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 px-4 py-2 border border-[var(--st-line)] rounded-lg hover:bg-[var(--st-hover)] transition-colors font-medium"
                >
                  <LogOut size={16} />
                  Sign Out
                </button>
              </div>
            </div>
          </div>

          {/* Account Info */}
          <div className="bg-[var(--st-panel)] rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-6">Account Information</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-[var(--st-muted)]">Account Type</span>
                <span className="font-medium capitalize">
                  {user?.subscription_plan || "Free"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--st-muted)]">Credits Remaining</span>
                <span className="font-medium">
                  {user?.monthly_remaining || 0}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--st-muted)]">Role</span>
                <span className="font-medium capitalize">
                  {user?.role || "User"}
                </span>
              </div>
            </div>
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
