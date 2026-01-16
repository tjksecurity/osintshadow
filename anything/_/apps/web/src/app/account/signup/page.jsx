"use client";

import { useState } from "react";
import useAuth from "@/utils/useAuth";
import { Eye, EyeOff } from "lucide-react";
import BrandLogo from "@/components/BrandLogo";

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
          "An account with this email already exists. Try signing in or reset your password.",
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
    <div className="min-h-screen bg-[#263043] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-[#2D384E] rounded-lg p-8 shadow-xl">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center mb-4">
              <BrandLogo className="h-8 w-auto" variant="onDark" />
            </div>
            <p className="text-slate-400">Create your account</p>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-6">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
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
                autoComplete="email"
                inputMode="email"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-[#37425B] border border-[#37425B] rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-[#00D1FF] focus:ring-1 focus:ring-[#00D1FF] pr-12"
                  placeholder="Enter your password"
                  autoComplete="new-password"
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
                Confirm Password
              </label>
              <input
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-3 bg-[#37425B] border border-[#37425B] rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-[#00D1FF] focus:ring-1 focus:ring-[#00D1FF]"
                placeholder="Confirm your password"
                autoComplete="new-password"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#00D1FF] text-[#263043] font-semibold py-3 rounded-lg hover:bg-[#00B8E6] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Creating account..." : "Create Account"}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-slate-400">
              Already have an account?{" "}
              <a
                href="/account/signin"
                className="text-[#00D1FF] hover:underline"
              >
                Sign in
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
