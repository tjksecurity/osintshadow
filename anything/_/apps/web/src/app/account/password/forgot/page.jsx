"use client";

import { useState } from "react";
import { Mail } from "lucide-react";
import BrandLogo from "@/components/BrandLogo";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [resetUrl, setResetUrl] = useState("");
  const [emailSent, setEmailSent] = useState(null); // null = unknown, true/false from API

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess(false);
    setResetUrl("");
    setEmailSent(null);

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
            `When fetching /api/auth/password/forgot, the response was [${res.status}] ${res.statusText}`,
        );
      }
      const data = await res.json();
      if (data?.resetUrl) {
        setResetUrl(data.resetUrl);
      }
      if (typeof data?.emailSent === "boolean") {
        setEmailSent(data.emailSent);
      }
      setSuccess(true);
    } catch (err) {
      console.error(err);
      setError(
        "We couldn't process that right now. Please try again in a moment.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#263043] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-[#2D384E] rounded-lg p-8 shadow-xl">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center mb-4">
              <BrandLogo className="h-8 w-auto" variant="onDark" />
            </div>
            <p className="text-slate-400">Reset your password</p>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-6">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {success ? (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3 mb-6">
              <p className="text-emerald-400 text-sm">
                If an account exists for that email, you'll get a reset link.
                Please check your inbox.
              </p>
              {emailSent === false && (
                <p className="text-slate-300 text-xs mt-2">
                  Email sending isn't configured yet, but you can use the link
                  below right away.
                </p>
              )}
              {resetUrl ? (
                <p className="text-slate-300 text-xs mt-3">
                  Reset link:{" "}
                  <a
                    href={resetUrl}
                    className="text-[#00D1FF] hover:underline break-all"
                  >
                    {resetUrl}
                  </a>
                </p>
              ) : null}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Email
                </label>
                <div className="relative">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 bg-[#37425B] border border-[#37425B] rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-[#00D1FF] focus:ring-1 focus:ring-[#00D1FF] pl-11"
                    placeholder="Enter your email"
                    required
                  />
                  <Mail
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    size={18}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#00D1FF] text-[#263043] font-semibold py-3 rounded-lg hover:bg-[#00B8E6] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Sending link..." : "Send reset link"}
              </button>
            </form>
          )}

          <div className="mt-6 text-center">
            <a
              href="/account/signin"
              className="text-[#00D1FF] hover:underline"
            >
              Back to sign in
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
