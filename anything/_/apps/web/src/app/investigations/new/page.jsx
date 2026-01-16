"use client";

import { useState, useEffect } from "react";
import useUser from "@/utils/useUser";
import { Plus, ArrowLeft } from "lucide-react";
import { Sidebar } from "@/components/NewInvestigation/Sidebar";
import { TopBar } from "@/components/NewInvestigation/TopBar";
import { CreditsWarning } from "@/components/NewInvestigation/CreditsWarning";
import { InvestigationForm } from "@/components/NewInvestigation/InvestigationForm";
import { InformationCard } from "@/components/NewInvestigation/InformationCard";
import { PaywallModal } from "@/components/NewInvestigation/PaywallModal";
import { useNewInvestigation } from "@/hooks/useNewInvestigation";

export default function NewInvestigation() {
  const { data: user, loading } = useUser();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const {
    targetType,
    setTargetType,
    targetValue,
    setTargetValue,
    includeWebScraping,
    setIncludeWebScraping,
    includeNSFW,
    setIncludeNSFW,
    includeDeepImageScan,
    setIncludeDeepImageScan,
    includeDeepScan,
    setIncludeDeepScan,
    includeCriminal,
    setIncludeCriminal,
    includeCourt,
    setIncludeCourt,
    includeProperty,
    setIncludeProperty,
    includeLicensePlate,
    setIncludeLicensePlate,
    plateRegion,
    setPlateRegion,

    // Social Media States
    includeSocialMedia,
    setIncludeSocialMedia,
    socialPlatforms,
    setSocialPlatforms,
    enableRealTimeMonitoring,
    setEnableRealTimeMonitoring,

    // NEW: Post Collection
    includePostCollection,
    setIncludePostCollection,

    submitting,
    error,
    errorCode,
    showPaywall,
    setShowPaywall,
    handleSubmit,
  } = useNewInvestigation();

  useEffect(() => {
    // Don't kick the user out mid-submit; allow the preflight to handle auth redirects
    if (!loading && !user && !submitting) {
      window.location.href = "/account/signin";
    }
  }, [loading, user, submitting]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#263043] flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  const isAdminEmail =
    (user?.email || "").toLowerCase() === "glossontravis@gmail.com";
  const isAdmin = user?.role === "admin" || isAdminEmail;
  const isTrial =
    !isAdmin &&
    (!user?.subscription_plan || user?.subscription_plan === "trial");

  return (
    <div className="flex min-h-screen text-white font-inter bg-[#263043]">
      <Sidebar
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        isAdmin={isAdmin}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <TopBar
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          user={user}
        />

        <section className="flex-1 p-6 space-y-6 overflow-auto">
          <div className="flex items-center gap-4">
            <a
              href="/dashboard"
              className="p-2 hover:bg-[#37425B] rounded-lg transition-colors"
            >
              <ArrowLeft className="text-slate-400" size={20} />
            </a>
            <div className="flex items-center gap-3">
              <Plus className="text-slate-400" size={24} />
              <h1 className="text-lg font-semibold">New Investigation</h1>
            </div>
          </div>

          <CreditsWarning monthlyRemaining={user?.monthly_remaining} />

          <InvestigationForm
            targetType={targetType}
            setTargetType={setTargetType}
            targetValue={targetValue}
            setTargetValue={setTargetValue}
            includeWebScraping={includeWebScraping}
            setIncludeWebScraping={setIncludeWebScraping}
            includeNSFW={includeNSFW}
            setIncludeNSFW={setIncludeNSFW}
            includeDeepImageScan={includeDeepImageScan}
            setIncludeDeepImageScan={setIncludeDeepImageScan}
            includeDeepScan={includeDeepScan}
            setIncludeDeepScan={setIncludeDeepScan}
            includeCriminal={includeCriminal}
            setIncludeCriminal={setIncludeCriminal}
            includeCourt={includeCourt}
            setIncludeCourt={setIncludeCourt}
            includeProperty={includeProperty}
            setIncludeProperty={setIncludeProperty}
            includeLicensePlate={includeLicensePlate}
            setIncludeLicensePlate={setIncludeLicensePlate}
            plateRegion={plateRegion}
            setPlateRegion={setPlateRegion}
            // Social Media Props
            includeSocialMedia={includeSocialMedia}
            setIncludeSocialMedia={setIncludeSocialMedia}
            socialPlatforms={socialPlatforms}
            setSocialPlatforms={setSocialPlatforms}
            enableRealTimeMonitoring={enableRealTimeMonitoring}
            setEnableRealTimeMonitoring={setEnableRealTimeMonitoring}
            submitting={submitting}
            error={error}
            errorCode={errorCode}
            handleSubmit={handleSubmit}
            user={user}
            isAdmin={isAdmin}
            isTrial={isTrial}
            includePostCollection={includePostCollection}
            setIncludePostCollection={setIncludePostCollection}
          />

          <InformationCard />
        </section>
      </div>

      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        ></div>
      )}

      <PaywallModal
        showPaywall={showPaywall}
        setShowPaywall={setShowPaywall}
        errorCode={errorCode}
      />
    </div>
  );
}
