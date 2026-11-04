"use client";

import { useState } from "react";
import useAuth from "@/utils/useAuth";
import { Eye, EyeOff } from "lucide-react";
import AccountLayout from "@/components/Theme/AccountLayout";

export default function SignUp() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { signUpWithCredentials } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    // Normalize email to lowercase so future sign-ins are consistent
    const submittedEmail = (email || "").trim().toLowerCase();
    if (!submittedEmail) {
      setError("Please enter a valid email");
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      setLoading(false);
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      setLoading(false);
      return;
    }

    try {
      await signUpWithCredentials({
        email: submittedEmail,
        password,
        callbackUrl: "/dashboard",
        redirect: true,
      });
    } catch (err) {
      console.error(err);
      const msg = String(err?.message || "").toLowerCase();
      if (msg.includes("unique") || msg.includes("already")) {
        setError(
          "An account with this email already exists. Try signing in or reset your password."
        );
      } else if (msg.includes("email")) {
        setError("Please enter a valid email");
      } else {
        setError("Failed to create account. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AccountLayout
      title="Create your account."
      description="Start your next line of inquiry."
      mode="signup"
    >
      {error && (
        <div
          role="alert"
          className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-6"
        >
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
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
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 bg-[var(--st-elevated)] border border-[var(--st-line)] rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-[var(--st-accent)] focus:ring-1 focus:ring-[var(--st-accent)]"
            placeholder="Enter your email"
            autoComplete="email"
            inputMode="email"
            required
          />
        </div>

        <div>
          <label
            htmlFor="account-password"
            className="block text-sm font-medium text-slate-300 mb-2"
          >
            Password
          </label>
          <div className="relative">
            <input
              id="account-password"
              name="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-[var(--st-elevated)] border border-[var(--st-line)] rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-[var(--st-accent)] focus:ring-1 focus:ring-[var(--st-accent)] pr-12"
              placeholder="Enter your password"
              autoComplete="new-password"
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
            htmlFor="account-confirmPassword"
            className="block text-sm font-medium text-slate-300 mb-2"
          >
            Confirm Password
          </label>
          <input
            id="account-confirmPassword"
            name="confirmPassword"
            type={showPassword ? "text" : "password"}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full px-4 py-3 bg-[var(--st-elevated)] border border-[var(--st-line)] rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-[var(--st-accent)] focus:ring-1 focus:ring-[var(--st-accent)]"
            placeholder="Confirm your password"
            autoComplete="new-password"
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[var(--st-accent)] text-[var(--st-bg)] font-semibold py-3 rounded-lg hover:bg-[var(--st-accent-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Creating account..." : "Create Account"}
        </button>
      </form>

      <div className="mt-6 text-center">
        <p className="text-[var(--st-muted)]">
          Already have an account?{" "}
          <a
            href="/account/signin"
            className="text-[var(--st-accent)] hover:underline"
          >
            Sign in
          </a>
        </p>
      </div>
    </AccountLayout>
  );
}
