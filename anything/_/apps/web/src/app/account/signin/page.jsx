"use client";

import { useEffect, useMemo, useState } from "react";
import useAuth from "@/utils/useAuth";
import { Eye, EyeOff } from "lucide-react";
import AccountLayout from "@/components/Theme/AccountLayout";

export default function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { signInWithCredentials } = useAuth();

  // Read callbackUrl and possible error from the URL safely on the client
  const searchParams =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search)
      : null;

  const callbackUrl = useMemo(() => {
    return (searchParams && searchParams.get("callbackUrl")) || "/dashboard";
  }, [searchParams]);

  useEffect(() => {
    if (!searchParams) return;
    const err = searchParams.get("error");
    if (!err) return;
    const errorMessages = {
      OAuthSignin: "Couldn’t start sign-in. Please try again.",
      OAuthCallback: "Sign-in failed after redirecting. Please try again.",
      OAuthCreateAccount: "Couldn’t create an account with this method.",
      EmailCreateAccount: "This email can’t be used to create an account.",
      Callback: "Something went wrong during sign-in. Please try again.",
      OAuthAccountNotLinked:
        "This email is linked to a different sign-in method.",
      CredentialsSignin: "Invalid email or password.",
      AccessDenied: "You don’t have permission to sign in.",
      Configuration: "Sign-in isn’t working right now. Please try again later.",
      Verification: "Your sign-in link has expired. Request a new one.",
    };
    setError(errorMessages[err] || "Something went wrong. Please try again.");
  }, [searchParams]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const submittedEmailRaw = (email || "").trim();
      if (!submittedEmailRaw || !password) {
        setError("Please fill in all fields");
        return;
      }

      // Normalize to lowercase to match server lookups and avoid case issues
      const submittedEmail = submittedEmailRaw.toLowerCase();

      const result = await signInWithCredentials({
        email: submittedEmail,
        password,
        callbackUrl,
        redirect: true,
      });

      if (result && result.error) {
        setError("Invalid email or password");
      }
    } catch (err) {
      console.error(err);
      setError("Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AccountLayout
      title="Welcome back."
      description="Sign in to continue your research."
    >
      {error && (
        <div
          role="alert"
          className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-6"
        >
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Single reliable path: handle submit via useAuth */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Hidden callback useful if a non-JS POST is attempted by the browser */}
        <input type="hidden" name="callbackUrl" value={callbackUrl} />

        <div>
          <label
            htmlFor="account-email"
            className="block text-sm font-medium text-slate-300 mb-2"
          >
            Email
          </label>
          <input
            id="account-email"
            autoComplete="email"
            name="email"
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
            htmlFor="account-password"
            className="block text-sm font-medium text-slate-300 mb-2"
          >
            Password
          </label>
          <div className="relative">
            <input
              id="account-password"
              autoComplete="current-password"
              name="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-[var(--st-elevated)] border border-[var(--st-line)] rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-[var(--st-accent)] focus:ring-1 focus:ring-[var(--st-accent)] pr-12"
              placeholder="Enter your password"
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

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[var(--st-accent)] text-[var(--st-bg)] font-semibold py-3 rounded-lg hover:bg-[var(--st-accent-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <div className="mt-6 space-y-3 text-center">
        <p className="text-[var(--st-muted)]">
          Don't have an account?{" "}
          <a
            href="/account/signup"
            className="text-[var(--st-accent)] hover:underline"
          >
            Sign up
          </a>
        </p>
        <p className="text-[var(--st-muted)]">
          <a
            href="/account/password/forgot"
            className="text-[var(--st-accent)] hover:underline"
          >
            Forgot your password?
          </a>
        </p>
      </div>
    </AccountLayout>
  );
}
