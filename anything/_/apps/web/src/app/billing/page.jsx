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
  Check,
  Crown,
  Zap,
  Building,
  Infinity,
} from "lucide-react";
import BrandLogo from "@/components/BrandLogo";

export default function Billing() {
  const { data: user, loading, refetch } = useUser();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [processingPlan, setProcessingPlan] = useState(null);

  // NEW: keep admin gating consistent with /administration and backend admin checks
  const isAdminEmail =
    (user?.email || "").toLowerCase() === "glossontravis@gmail.com";
  const isAdmin = user?.role === "admin" || isAdminEmail;

  const plans = [
    {
      id: "starter",
      name: "Starter",
      price: 49,
      credits: 10,
      icon: Zap,
      features: [
        "10 investigations per month",
        "Basic OSINT data collection",
        "AI risk analysis",
        "PDF reports",
        "Email support",
      ],
    },
    {
      id: "pro",
      name: "Pro",
      price: 99,
      credits: 50,
      icon: Crown,
      popular: true,
      features: [
        "50 investigations per month",
        "Advanced OSINT data collection",
        "Enhanced AI analysis",
        "PDF & HTML reports",
        "Map visualization",
        "Priority support",
      ],
    },
    {
      id: "agency",
      name: "Agency",
      price: 249,
      credits: 200,
      icon: Building,
      features: [
        "200 investigations per month",
        "Premium OSINT sources",
        "Advanced AI correlation",
        "Custom report branding",
        "API access",
        "Dedicated support",
      ],
    },
    {
      id: "lifetime",
      name: "Lifetime Agency",
      price: 999,
      credits: 200,
      icon: Infinity,
      lifetime: true,
      features: [
        "200 investigations per month",
        "Lifetime access",
        "All premium features",
        "Priority support",
        "Future updates included",
        "No recurring payments",
      ],
    },
  ];

  // Confirm Stripe checkout success (fallback when webhooks are not configured)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const success = url.searchParams.get("success");
    const sessionId = url.searchParams.get("session_id");

    if (!success || !sessionId) return;

    let cancelled = false;

    const confirm = async () => {
      try {
        const response = await fetch("/api/stripe/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_id: sessionId }),
        });

        if (!response.ok) {
          throw new Error(
            `When posting /api/stripe/confirm, the response was [${response.status}] ${response.statusText}`,
          );
        }

        const data = await response.json();
        if (cancelled) return;

        if (data?.applied) {
          // Refresh user so plan + credits update in the UI
          await refetch();
        }

        // Clean URL params so refresh doesn't re-confirm
        try {
          url.searchParams.delete("success");
          url.searchParams.delete("session_id");
          window.history.replaceState({}, "", url.toString());
        } catch (_) {
          // no-op
        }
      } catch (e) {
        console.error("Stripe confirm failed", e);
      }
    };

    confirm();

    return () => {
      cancelled = true;
    };
  }, [refetch]);

  const handleUpgrade = async (planId) => {
    setProcessingPlan(planId);

    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ plan: planId }),
      });

      if (!response.ok) {
        throw new Error("Failed to create checkout session");
      }

      const { url } = await response.json();

      // The app runs in an iframe while building; open Stripe in a new window.
      const popup = window.open(url, "_blank", "popup");
      if (!popup) {
        window.location.href = url;
      }
    } catch (error) {
      console.error("Error creating checkout session:", error);
      alert("Failed to start checkout process. Please try again.");
    } finally {
      setProcessingPlan(null);
    }
  };

  const handleManageBilling = async () => {
    try {
      const response = await fetch("/api/stripe/portal", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Failed to create portal session");
      }

      const { url } = await response.json();
      const popup = window.open(url, "_blank", "popup");
      if (!popup) {
        window.location.href = url;
      }
    } catch (error) {
      console.error("Error creating portal session:", error);
      alert("Failed to open billing portal. Please try again.");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#263043] flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  if (!user) {
    window.location.href = "/account/signin";
    return null;
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
          <li className="flex items-center gap-3 py-2 px-6 bg-[#303B52] border-l-2 border-[#00D1FF] text-white">
            <CreditCard size={18} />
            <span>Billing</span>
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

        {isAdmin && (
          <>
            <hr className="border-t border-[#37425B] my-4" />
            <div className="text-slate-400 text-xs uppercase px-6 mb-2">
              Admin Portal
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
                <User size={16} />
              </div>
              <span className="text-sm font-medium">
                {user.name || user.email}
              </span>
            </div>
          </div>
        </nav>

        {/* Main Content Area */}
        <section className="flex-1 p-6 space-y-6 overflow-auto">
          {/* Page Header */}
          <div className="flex items-center gap-3">
            <CreditCard className="text-slate-400" size={24} />
            <h1 className="text-lg font-semibold">Billing & Subscription</h1>
          </div>

          {/* Current Plan Status */}
          <div className="bg-[#2D384E] rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4">Current Plan</h2>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-300">
                  {user.subscription_plan ? (
                    <>
                      <span className="capitalize font-medium">
                        {user.subscription_plan}
                      </span>{" "}
                      Plan
                    </>
                  ) : (
                    "No active subscription"
                  )}
                </p>
                <p className="text-slate-400 text-sm">
                  {user.monthly_remaining || 0} credits remaining this month
                </p>
              </div>
              {user.stripe_customer_id && (
                <button
                  onClick={handleManageBilling}
                  className="px-4 py-2 border border-[#37425B] rounded-lg hover:bg-[#37425B] transition-colors"
                >
                  Manage Billing
                </button>
              )}
            </div>
          </div>

          {/* Pricing Plans */}
          <div>
            <h2 className="text-lg font-semibold mb-6">Choose Your Plan</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {plans.map((plan) => {
                const IconComponent = plan.icon;
                const isCurrentPlan = user.subscription_plan === plan.id;

                return (
                  <div
                    key={plan.id}
                    className={`relative bg-[#2D384E] rounded-lg p-6 border transition-all ${
                      plan.popular
                        ? "border-[#00D1FF] ring-1 ring-[#00D1FF]/20"
                        : "border-[#37425B] hover:border-[#37425B]/80"
                    }`}
                  >
                    {plan.popular && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <span className="bg-[#00D1FF] text-[#263043] px-3 py-1 rounded-full text-xs font-semibold">
                          Most Popular
                        </span>
                      </div>
                    )}

                    <div className="text-center mb-6">
                      <IconComponent
                        className={`mx-auto mb-3 ${
                          plan.popular ? "text-[#00D1FF]" : "text-slate-400"
                        }`}
                        size={32}
                      />
                      <h3 className="text-lg font-semibold mb-2">
                        {plan.name}
                      </h3>
                      <div className="mb-2">
                        <span className="text-3xl font-bold">
                          ${plan.price}
                        </span>
                        {!plan.lifetime && (
                          <span className="text-slate-400">/month</span>
                        )}
                      </div>
                      <p className="text-slate-400 text-sm">
                        {plan.credits} investigations{" "}
                        {plan.lifetime ? "per month for life" : "per month"}
                      </p>
                    </div>

                    <ul className="space-y-3 mb-6">
                      {plan.features.map((feature, index) => (
                        <li
                          key={index}
                          className="flex items-start gap-2 text-sm"
                        >
                          <Check
                            className="text-green-400 flex-shrink-0 mt-0.5"
                            size={16}
                          />
                          <span className="text-slate-300">{feature}</span>
                        </li>
                      ))}
                    </ul>

                    <button
                      onClick={() => handleUpgrade(plan.id)}
                      disabled={isCurrentPlan || processingPlan === plan.id}
                      className={`w-full py-3 rounded-lg font-semibold transition-colors ${
                        isCurrentPlan
                          ? "bg-green-500/20 text-green-400 cursor-not-allowed"
                          : plan.popular
                            ? "bg-[#00D1FF] text-[#263043] hover:bg-[#00B8E6]"
                            : "bg-[#37425B] text-white hover:bg-[#303B52]"
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {processingPlan === plan.id
                        ? "Processing..."
                        : isCurrentPlan
                          ? "Current Plan"
                          : plan.lifetime
                            ? "Buy Lifetime"
                            : "Upgrade"}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* FAQ Section */}
          <div className="bg-[#2D384E] rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-6">
              Frequently Asked Questions
            </h2>
            <div className="space-y-4">
              <div>
                <h3 className="font-medium mb-2">
                  What happens if I run out of credits?
                </h3>
                <p className="text-slate-400 text-sm">
                  You won't be able to start new investigations until your
                  credits reset at the beginning of the next billing cycle or
                  you upgrade your plan.
                </p>
              </div>
              <div>
                <h3 className="font-medium mb-2">
                  Can I change my plan anytime?
                </h3>
                <p className="text-slate-400 text-sm">
                  Yes, you can upgrade or downgrade your plan at any time.
                  Changes will be prorated and take effect immediately.
                </p>
              </div>
              <div>
                <h3 className="font-medium mb-2">
                  What payment methods do you accept?
                </h3>
                <p className="text-slate-400 text-sm">
                  We accept all major credit cards through Stripe's secure
                  payment processing.
                </p>
              </div>
              <div>
                <h3 className="font-medium mb-2">Is there a free trial?</h3>
                <p className="text-slate-400 text-sm">
                  New users get 3 free investigation credits to try the platform
                  before subscribing.
                </p>
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
