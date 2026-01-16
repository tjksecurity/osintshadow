"use client";

import { useEffect, useState } from "react";
import useAuth from "@/utils/useAuth";
import { Lock, Eye, EyeOff } from "lucide-react";
import BrandLogo from "@/components/BrandLogo";

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
        "Missing token or email. Please use the link from your email again.",
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
            `When fetching /api/auth/password/reset, the response was [${res.status}] ${res.statusText}`,
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
    <div className="min-h-screen bg-[#263043] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-[#2D384E] rounded-lg p-8 shadow-xl">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center mb-4">
              <BrandLogo className="h-8 w-auto" variant="onDark" />
            </div>
            <p className="text-slate-400">Choose a new password</p>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-6">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {success && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3 mb-6">
              <p className="text-emerald-400 text-sm">
                Password updated. Redirecting…
              </p>
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-[#37425B] border border-[#37425B] rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-[#00D1FF] focus:ring-1 focus:ring-[#00D1FF]"
                placeholder="Enter your email"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Token
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  className="w-full px-4 py-3 bg-[#37425B] border border-[#37425B] rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-[#00D1FF] focus:ring-1 focus:ring-[#00D1FF] pl-11"
                  placeholder="Paste your token"
                  required
                />
                <Lock
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  size={18}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                New Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-[#37425B] border border-[#37425B] rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-[#00D1FF] focus:ring-1 focus:ring-[#00D1FF] pr-12"
                  placeholder="Enter new password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Confirm New Password
              </label>
              <input
                type={showPassword ? "text" : "password"}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full px-4 py-3 bg-[#37425B] border border-[#37425B] rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-[#00D1FF] focus:ring-1 focus:ring-[#00D1FF]"
                placeholder="Confirm new password"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#00D1FF] text-[#263043] font-semibold py-3 rounded-lg hover:bg-[#00B8E6] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Updating..." : "Update password"}
            </button>
          </form>

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
