"use client";

import { useState } from "react";
import { Mail } from "lucide-react";
import AccountLayout from "@/components/Theme/AccountLayout";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess(false);

    const normalized = email.trim().toLowerCase();
    if (!normalized) return;

    try {
      setLoading(true);
      const res = await fetch("/api/auth/password/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalized }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          data?.error ||
            `When fetching /api/auth/password/forgot, the response was [${res.status}] ${res.statusText}`
        );
      }
      setSuccess(true);
    } catch (err) {
      console.error(err);
      setError(
        "We couldn't process that right now. Please try again in a moment."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AccountLayout
      title="Reset your password."
      description="Enter your email to request a reset link."
    >
      {error && (
        <div
          role="alert"
          className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-6"
        >
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {success ? (
        <div
          role="status"
          className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3 mb-6"
        >
          <p className="text-emerald-400 text-sm">
            Check your inbox for password reset instructions. If you don't
            receive an email, contact support.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label
              htmlFor="account-email"
              className="block text-sm font-medium text-slate-300 mb-2"
            >
              Email
            </label>
            <div className="relative">
              <input
                id="account-email"
                name="email"
                autoComplete="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-[var(--st-elevated)] border border-[var(--st-line)] rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-[var(--st-accent)] focus:ring-1 focus:ring-[var(--st-accent)] pl-11"
                placeholder="Enter your email"
                required
              />
              <Mail
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--st-muted)]"
                size={18}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[var(--st-accent)] text-[var(--st-bg)] font-semibold py-3 rounded-lg hover:bg-[var(--st-accent-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Sending link..." : "Send reset link"}
          </button>
        </form>
      )}

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
