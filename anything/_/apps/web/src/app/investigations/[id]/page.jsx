"use client";

import React, { useState, useEffect, useRef } from "react";
import useUser from "@/utils/useUser";
import {
  ArrowLeft,
  AlertTriangle,
  CheckCircle2,
  Circle,
  Loader2,
} from "lucide-react";
import { useInvestigation } from "@/hooks/useInvestigation";
import { useInvestigationProgress } from "@/hooks/useInvestigationProgress";
import { useInvestigationData } from "@/hooks/useInvestigationData";
import {
  parseSeverity,
  chipClasses,
  riskColor,
} from "@/utils/investigationHelpers";
import { InvestigationHeader } from "@/components/InvestigationDetail/InvestigationHeader";
import { StatusBadge } from "@/components/InvestigationDetail/StatusBadge";
import { OverviewCards } from "@/components/InvestigationDetail/OverviewCards";
import { TabNavigation } from "@/components/InvestigationDetail/TabNavigation";
import { OverviewTab } from "@/components/InvestigationDetail/OverviewTab";
import { AIAnalysisTab } from "@/components/InvestigationDetail/AIAnalysisTab";
import { OSINTTab } from "@/components/InvestigationDetail/OSINTTab";
import { MapTab } from "@/components/InvestigationDetail/MapTab";
import { ReportTab } from "@/components/InvestigationDetail/ReportTab";
import { ConfirmedDataTab } from "@/components/InvestigationDetail/ConfirmedDataTab";
import { ImagesTab } from "@/components/InvestigationDetail/ImagesTab";
import { RecordsTab } from "@/components/InvestigationDetail/RecordsTab";
import { SocialMediaTab } from "@/components/InvestigationDetail/SocialMediaTab";
// NEW: Import enhanced tabs
import TimelineTab from "@/components/InvestigationDetail/TimelineTab";
import AssociatesTab from "@/components/InvestigationDetail/AssociatesTab";
import SocialPostsTab from "@/components/InvestigationDetail/SocialPostsTab";
import DeconflictionTab from "@/components/InvestigationDetail/DeconflictionTab";

// Simple error boundary to catch any runtime errors in subviews
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }
  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      message: error?.message || "Something went wrong",
    };
  }
  componentDidCatch(error, info) {
    console.error("Investigation page crashed:", error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#263043] text-white p-6">
          <div className="max-w-5xl mx-auto">
            <a
              href="/dashboard"
              className="inline-flex items-center gap-2 text-slate-300 hover:text-white"
            >
              <ArrowLeft size={18} /> Back to Dashboard
            </a>
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mt-4">
              <AlertTriangle className="text-red-400" size={20} />
              <div className="mt-2 text-red-300 break-words">
                {this.state.message}
              </div>
              <div className="mt-3">
                <button
                  onClick={() => window.location.reload()}
                  className="px-3 py-1.5 border border-[#37425B] rounded hover:bg-[#37425B]"
                >
                  Reload page
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function InvestigationDetail(props) {
  const id = props?.params?.id;
  const { data: user, loading: userLoading } = useUser();
  const [activeTab, setActiveTab] = useState("overview");

  // NEW: local heartbeat so the UI can show time passing even if data is unchanged
  const [pollHeartbeat, setPollHeartbeat] = useState(Date.now());

  // NEW: show tick failures in the UI (otherwise it silently looks stuck)
  const [lastTickError, setLastTickError] = useState(null);

  // NEW: opt-in debug view for Server-Timing data (add ?debugTiming=1 to the URL)
  const [debugTimingEnabled, setDebugTimingEnabled] = useState(false);
  const [lastServerTiming, setLastServerTiming] = useState([]);

  // NEW: avoid repeatedly trying to start processing
  const startRequestedRef = useRef(false);

  // NEW: tick runner (step-based processing) state
  const tickInFlightRef = useRef(false);
  const tickTimerRef = useRef(null);

  const {
    investigation,
    isLoading,
    error,
    refetch,
    regenerate,
    isRegenerating,
  } = useInvestigation(id);

  const investigationStatus = investigation?.status;

  // NEW: if we land on a queued investigation (common in production), trigger processing.
  useEffect(() => {
    const run = async () => {
      try {
        const res = await fetch(`/api/investigations/${id}/start`, {
          method: "POST",
          headers: { Accept: "application/json" },
        });
        if (!res.ok) {
          console.error(
            `When posting /api/investigations/${id}/start, the response was [${res.status}] ${res.statusText}`,
          );
        }
      } catch (e) {
        console.error("Failed to start investigation processing", e);
      }
    };

    if (!id) return;
    if (!investigationStatus) return;

    // Allow re-start after a regenerate: once the investigation leaves "queued",
    // permit a future queued transition to trigger again.
    if (investigationStatus !== "queued") {
      startRequestedRef.current = false;
      return;
    }

    if (startRequestedRef.current) return;

    startRequestedRef.current = true;
    run();
  }, [id, investigationStatus]);

  // NEW: heartbeat updates once per second while we expect live polling
  useEffect(() => {
    const shouldBeat =
      investigationStatus === "queued" || investigationStatus === "processing";

    if (!shouldBeat) {
      return;
    }

    const t = setInterval(() => {
      setPollHeartbeat(Date.now());
    }, 1000);

    return () => clearInterval(t);
  }, [investigationStatus]);

  // NEW: tick processing while status is processing
  useEffect(() => {
    const shouldTick =
      investigationStatus === "processing" || investigationStatus === "queued";

    const stop = () => {
      if (tickTimerRef.current) {
        clearTimeout(tickTimerRef.current);
        tickTimerRef.current = null;
      }
    };

    const tickOnce = async () => {
      if (!id) return;
      if (!shouldTick) return;
      if (tickInFlightRef.current) return;

      tickInFlightRef.current = true;

      const controller =
        typeof AbortController !== "undefined" ? new AbortController() : null;

      // investigation steps (OSINT + AI) can legitimately take >25s on the published site.
      // If we abort too early, the UI looks "stuck" even though the server is still working.
      const timeoutId = controller
        ? setTimeout(() => {
            try {
              controller.abort();
            } catch (_) {}
          }, 90000)
        : null;

      try {
        const res = await fetch(`/api/investigations/${id}/tick`, {
          method: "POST",
          headers: { Accept: "application/json" },
          signal: controller ? controller.signal : undefined,
        });

        // 202 means another tick is currently running. That's fine.
        if (res.status === 202) {
          setLastTickError(null);
        } else if (!res.ok) {
          let payload = null;
          try {
            payload = await res.json();
          } catch (_) {}

          const msg =
            payload?.details ||
            payload?.error ||
            `Tick failed (${res.status}) ${res.statusText}`;
          const step = payload?.step ? ` step=${payload.step}` : "";
          const dbg = payload?.debugId ? ` debugId=${payload.debugId}` : "";

          setLastTickError(`${msg}${step}${dbg}`);

          console.error(
            `When posting /api/investigations/${id}/tick, the response was [${res.status}] ${res.statusText}`,
            payload,
          );
        } else {
          setLastTickError(null);
        }
      } catch (e) {
        // Abort means the server took too long. We'll retry.
        const isAbort =
          e?.name === "AbortError" ||
          String(e?.message || "").includes("aborted");
        const msg = isAbort
          ? "Tick request timed out in the browser (server may still be running). Retrying…"
          : e?.message || "Tick request failed";

        console.warn("Tick request failed", e);
        setLastTickError(msg);
      } finally {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        tickInFlightRef.current = false;

        // schedule next tick
        if (shouldTick) {
          tickTimerRef.current = setTimeout(() => {
            tickOnce();
          }, 1500);
        }
      }
    };

    if (!id) return;

    if (!shouldTick) {
      stop();
      return;
    }

    // start ticking
    tickOnce();

    return () => {
      stop();
    };
  }, [id, investigationStatus]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const enabled =
      new URLSearchParams(window.location.search).get("debugTiming") === "1";
    setDebugTimingEnabled(enabled);
  }, []);

  useEffect(() => {
    if (!debugTimingEnabled) return;
    if (typeof window === "undefined") return;
    if (!id) return;

    if (typeof PerformanceObserver === "undefined") {
      return;
    }

    let observer;
    try {
      observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const urlNeedle = `/api/investigations/${id}/progress`;

        for (const entry of entries) {
          // Only care about progress polling requests.
          if (typeof entry?.name !== "string") continue;
          if (!entry.name.includes(urlNeedle)) continue;

          const timing = Array.isArray(entry.serverTiming)
            ? entry.serverTiming
            : [];

          if (timing.length > 0) {
            setLastServerTiming(timing);
          }
        }
      });

      observer.observe({ type: "resource", buffered: true });
    } catch (e) {
      console.warn("Could not attach PerformanceObserver", e);
    }

    return () => {
      try {
        observer?.disconnect();
      } catch (_) {}
    };
  }, [debugTimingEnabled, id]);

  const {
    data: progressData,
    isLoading: progressLoading,
    error: progressError,
    dataUpdatedAt: progressDataUpdatedAt,
  } = useInvestigationProgress(id, investigationStatus);

  const {
    ai,
    summaryPreview,
    anomaliesPreviewItems,
    osint,
    center,
    confirmed,
    hasConfirmed,
    imagesItems,
    hasImages,
  } = useInvestigationData(investigation);

  // --- progress UI derived state (keep JSX simple) ---
  const progressPercent =
    typeof progressData?.percent === "number"
      ? progressData.percent
      : investigationStatus === "completed"
        ? 100
        : 0;

  const progressEvents = Array.isArray(progressData?.events)
    ? progressData.events
    : [];

  const lastProgressEvent =
    progressEvents.length > 0
      ? progressEvents[progressEvents.length - 1]
      : null;

  const formatTime = (isoOrDate) => {
    try {
      const d = new Date(isoOrDate);
      if (Number.isNaN(d.getTime())) return null;
      return d.toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    } catch (_) {
      return null;
    }
  };

  const lastUpdatedTime = lastProgressEvent?.created_at
    ? formatTime(lastProgressEvent.created_at)
    : null;

  const pollTimeSource = progressData?._clientFetchedAt
    ? progressData._clientFetchedAt
    : progressDataUpdatedAt
      ? new Date(progressDataUpdatedAt).toISOString()
      : progressData?.serverTime;

  // NEW: if we are polling, always show a ticking local time too
  const fallbackPollTime = new Date(pollHeartbeat).toISOString();

  const pollTime = pollTimeSource
    ? formatTime(pollTimeSource)
    : formatTime(fallbackPollTime);

  const lastEventId =
    typeof progressData?.lastEventId === "number" &&
    Number.isFinite(progressData.lastEventId)
      ? progressData.lastEventId
      : null;

  const timingSummary = progressData?.timing || null;

  const isPolling =
    investigationStatus === "queued" || investigationStatus === "processing";

  const progressErrorText = progressError?.message || null;

  const serverTimingLines = debugTimingEnabled
    ? lastServerTiming
        .filter((t) => t?.name)
        .map((t) => {
          const dur =
            typeof t?.duration === "number" && Number.isFinite(t.duration)
              ? `${t.duration.toFixed(1)}ms`
              : "";
          const desc = t?.description ? ` — ${t.description}` : "";
          return `${t.name}: ${dur}${desc}`;
        })
    : [];

  const allSteps = [
    { key: "osint", label: "Collect OSINT" },
    { key: "social_profiles", label: "Search social profiles" },
    { key: "social_posts", label: "Collect social posts" },
    { key: "ai", label: "Run AI analysis" },
    { key: "deconflict", label: "Deconflict sources" },
    { key: "geo", label: "Build map markers" },
    { key: "report", label: "Build report" },
  ];

  const completedStepKeys = new Set(
    progressEvents
      .filter((e) => e?.event_status === "completed" && e?.step_key)
      .map((e) => e.step_key),
  );

  const currentStepKey = progressData?.currentStep?.step_key || null;

  const stepsWithState = allSteps.map((s) => {
    const isDone = completedStepKeys.has(s.key);
    const isCurrent = !isDone && currentStepKey === s.key;
    const state = isDone ? "done" : isCurrent ? "current" : "todo";
    return { ...s, state };
  });

  const remainingCount = stepsWithState.filter(
    (s) => s.state === "todo",
  ).length;

  useEffect(() => {
    if (!userLoading && !user) {
      window.location.href = "/account/signin";
    }
  }, [user, userLoading]);

  const handleRegenerate = () => {
    regenerate();
    setActiveTab("ai");
  };

  if (userLoading || isLoading) {
    return (
      <div className="min-h-screen bg-[#263043] flex items-center justify-center text-white">
        Loading...
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#263043] text-white p-6">
        <div className="max-w-5xl mx-auto">
          <a
            href="/dashboard"
            className="inline-flex items-center gap-2 text-slate-300 hover:text-white"
          >
            <ArrowLeft size={18} /> Back to Dashboard
          </a>
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mt-4">
            <AlertTriangle className="text-red-400" size={20} />
            <div className="mt-2 text-red-300">
              Failed to load investigation.
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Render a lightweight placeholder instead of null to avoid any accidental reads
  if (!investigation) {
    return (
      <div className="min-h-screen bg-[#263043] text-white p-6">
        <div className="max-w-5xl mx-auto">
          <div className="h-8 w-48 bg-[#2D384E] rounded mb-4" />
          <div className="h-6 w-72 bg-[#2D384E] rounded mb-6" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="h-32 bg-[#2D384E] rounded" />
            <div className="h-32 bg-[#2D384E] rounded" />
            <div className="h-32 bg-[#2D384E] rounded" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-[#263043] text-white">
        <InvestigationHeader
          investigation={investigation}
          statusBadge={<StatusBadge status={investigation.status} />}
          onRefresh={refetch}
          onRegenerate={handleRegenerate}
          isRegenerating={isRegenerating}
        />

        <main className="max-w-6xl mx-auto px-6 py-6 space-y-6">
          <OverviewCards
            investigation={investigation}
            ai={ai}
            summaryPreview={summaryPreview}
            anomaliesPreviewItems={anomaliesPreviewItems}
            parseSeverity={parseSeverity}
            chipClasses={chipClasses}
            riskColor={riskColor}
            onOpenAITab={() => setActiveTab("ai")}
          />

          {/* Live progress */}
          <section className="bg-[#2D384E] border border-[#37425B] rounded-xl p-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <div className="text-sm text-slate-300">Live status</div>
                <div className="text-white font-medium">
                  {progressData?.currentStep?.step_label ||
                    (investigationStatus === "completed"
                      ? "Complete"
                      : investigationStatus === "failed"
                        ? "Failed"
                        : investigationStatus === "processing"
                          ? "Working…"
                          : "Queued")}
                </div>
                {progressData?.currentStep?.message ? (
                  <div className="text-sm text-slate-300 mt-1 break-words">
                    {progressData.currentStep.message}
                  </div>
                ) : null}
                {isPolling ? (
                  <div className="text-xs text-slate-400 mt-1">
                    Polling every ~1s
                  </div>
                ) : null}

                {lastEventId !== null ? (
                  <div className="text-xs text-slate-500 mt-1">
                    Last event id: {lastEventId}
                  </div>
                ) : null}

                {debugTimingEnabled ? (
                  <div className="text-xs text-slate-500 mt-2">
                    Server-Timing (debug)
                    {serverTimingLines.length === 0 ? (
                      <div className="mt-1">No Server-Timing data yet.</div>
                    ) : (
                      <ul className="mt-1 list-disc list-inside">
                        {serverTimingLines.map((line) => (
                          <li key={line} className="break-words">
                            {line}
                          </li>
                        ))}
                      </ul>
                    )}
                    {timingSummary ? (
                      <div className="mt-2 text-slate-500">
                        API timing: auth {timingSummary.authMs}ms · inv{" "}
                        {timingSummary.invMs}ms · events{" "}
                        {timingSummary.eventsMs}ms · total{" "}
                        {timingSummary.totalMs}ms
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className="min-w-[220px]">
                <div className="flex items-center justify-between text-sm text-slate-300">
                  <span>{progressPercent}%</span>
                  {lastUpdatedTime ? (
                    <span className="text-slate-400">
                      Updated {lastUpdatedTime}
                    </span>
                  ) : (
                    <span className="text-slate-400">No updates yet</span>
                  )}
                </div>
                {pollTime ? (
                  <div className="text-xs text-slate-500 mt-1">
                    Last checked {pollTime}
                  </div>
                ) : null}
                <div className="h-2 bg-[#263043] rounded mt-2 overflow-hidden">
                  <div
                    className="h-2 bg-[#4F8CFF]"
                    style={{
                      width: `${Math.min(100, Math.max(0, progressPercent))}%`,
                    }}
                  />
                </div>
                <div className="text-xs text-slate-400 mt-2">
                  {remainingCount === 0
                    ? "Nothing left"
                    : `${remainingCount} step(s) left`}
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-2">
              {stepsWithState.map((s) => {
                const icon =
                  s.state === "done" ? (
                    <CheckCircle2 size={18} className="text-green-400" />
                  ) : s.state === "current" ? (
                    <Loader2 size={18} className="text-[#4F8CFF]" />
                  ) : (
                    <Circle size={18} className="text-slate-500" />
                  );

                const textClass =
                  s.state === "done"
                    ? "text-slate-200"
                    : s.state === "current"
                      ? "text-white"
                      : "text-slate-400";

                return (
                  <div
                    key={s.key}
                    className="flex items-center gap-2 border border-[#37425B] rounded-lg px-3 py-2"
                  >
                    {icon}
                    <div className={textClass}>{s.label}</div>
                  </div>
                );
              })}
            </div>

            {progressLoading ? (
              <div className="text-sm text-slate-400 mt-3">
                Loading progress…
              </div>
            ) : null}

            {progressErrorText ? (
              <div className="text-sm text-red-300 mt-3 break-words">
                Couldn’t load live progress: {progressErrorText}
              </div>
            ) : null}

            {/* NEW: show tick errors plainly */}
            {lastTickError ? (
              <div className="mt-3 text-sm text-red-300 break-words">
                Processing error: {lastTickError}
              </div>
            ) : null}
          </section>

          <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />

          {activeTab === "overview" && (
            <OverviewTab
              ai={ai}
              parseSeverity={parseSeverity}
              chipClasses={chipClasses}
            />
          )}

          {activeTab === "ai" && <AIAnalysisTab ai={ai} />}

          {/* NEW: Timeline tab */}
          {activeTab === "timeline" && (
            <TimelineTab investigation={investigation} />
          )}

          {/* NEW: Associates tab */}
          {activeTab === "associates" && (
            <AssociatesTab investigation={investigation} />
          )}

          {activeTab === "osint" && <OSINTTab osint={osint} />}

          {activeTab === "social" && (
            <SocialMediaTab investigationId={investigation.id} />
          )}

          {/* NEW: Social Posts tab */}
          {activeTab === "posts" && (
            <SocialPostsTab investigation={investigation} />
          )}

          {activeTab === "map" && (
            <MapTab investigation={investigation} center={center} />
          )}

          {activeTab === "report" && (
            <ReportTab investigation={investigation} user={user} />
          )}

          {activeTab === "confirmed" && (
            <ConfirmedDataTab
              confirmed={confirmed}
              hasConfirmed={hasConfirmed}
              osintRaw={investigation?.osint_raw}
            />
          )}

          {activeTab === "deconfliction" && (
            <DeconflictionTab osintRaw={investigation?.osint_raw} />
          )}

          {activeTab === "images" && (
            <ImagesTab
              investigation={investigation}
              imagesItems={imagesItems}
              hasImages={hasImages}
            />
          )}

          {activeTab === "records" && <RecordsTab osint={osint} />}
        </main>
      </div>
    </ErrorBoundary>
  );
}
