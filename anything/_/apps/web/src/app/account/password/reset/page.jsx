"use client";

import { useEffect, useState } from "react";
import useAuth from "@/utils/useAuth";
import { Lock, Eye, EyeOff } from "lucide-react";
import AccountLayout from "@/components/Theme/AccountLayout";

export default function ResetPasswordPage() {
  const { signInWithCredentials } = useAuth();
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    const emailParam = sp.get("email");
    const tokenParam = sp.get("token");
    if (emailParam) setEmail(emailParam);
    if (tokenParam) setToken(tokenParam);
  }, []);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess(false);

    const normalized = email.trim().toLowerCase();

    if (!normalized || !token) {
      setError(
        "Missing token or email. Please use the link from your email again."
      );
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }

    try {
      setLoading(true);
      const res = await fetch("/api/auth/password/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalized, token, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          data?.error ||
            `When fetching /api/auth/password/reset, the response was [${res.status}] ${res.statusText}`
        );
      }

      setSuccess(true);

      // Auto sign-in with new password
      try {
        await signInWithCredentials({
          email: normalized,
          password,
          callbackUrl: "/dashboard",
          redirect: true,
        });
      } catch (e) {
        // If auto sign-in fails, leave the user on this page with success state
        console.error("Auto sign-in after reset failed", e);
      }
    } catch (err) {
      console.error(err);
      setError(err?.message || "Could not reset password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AccountLayout
      title="Set a new password."
      description="Use the details from your reset email."
    >
      {error && (
        <div
          role="alert"
          className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-6"
        >
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {success && (
        <div
          role="status"
          className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3 mb-6"
        >
          <p className="text-emerald-400 text-sm">
            Password updated. Redirecting…
          </p>
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-6">
        <div>
          <label
            htmlFor="account-email"
            className="block text-sm font-medium text-slate-300 mb-2"
          >
            Email
          </label>
          <input
            id="account-email"
            name="email"
            autoComplete="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 bg-[var(--st-elevated)] border border-[var(--st-line)] rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-[var(--st-accent)] focus:ring-1 focus:ring-[var(--st-accent)]"
            placeholder="Enter your email"
            required
          />
        </div>

        <div>
          <label
            htmlFor="account-token"
            className="block text-sm font-medium text-slate-300 mb-2"
          >
            Token
          </label>
          <div className="relative">
            <input
              id="account-token"
              name="token"
              autoComplete="one-time-code"
              type="text"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className="w-full px-4 py-3 bg-[var(--st-elevated)] border border-[var(--st-line)] rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-[var(--st-accent)] focus:ring-1 focus:ring-[var(--st-accent)] pl-11"
              placeholder="Paste your token"
              required
            />
            <Lock
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--st-muted)]"
              size={18}
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="account-password"
            className="block text-sm font-medium text-slate-300 mb-2"
          >
            New Password
          </label>
          <div className="relative">
            <input
              id="account-password"
              name="password"
              autoComplete="new-password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-[var(--st-elevated)] border border-[var(--st-line)] rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-[var(--st-accent)] focus:ring-1 focus:ring-[var(--st-accent)] pr-12"
              placeholder="Enter new password"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--st-muted)] hover:text-white"
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
        </div>

        <div>
          <label
            htmlFor="account-confirm"
            className="block text-sm font-medium text-slate-300 mb-2"
          >
            Confirm New Password
          </label>
          <input
            id="account-confirm"
            name="confirm"
            autoComplete="new-password"
            type={showPassword ? "text" : "password"}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="w-full px-4 py-3 bg-[var(--st-elevated)] border border-[var(--st-line)] rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-[var(--st-accent)] focus:ring-1 focus:ring-[var(--st-accent)]"
            placeholder="Confirm new password"
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[var(--st-accent)] text-[var(--st-bg)] font-semibold py-3 rounded-lg hover:bg-[var(--st-accent-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Updating..." : "Update password"}
        </button>
      </form>

      <div className="mt-6 text-center">
        <a
          href="/account/signin"
          className="text-[var(--st-accent)] hover:underline"
        >
          Back to sign in
        </a>
      </div>
    </AccountLayout>
  );
}
