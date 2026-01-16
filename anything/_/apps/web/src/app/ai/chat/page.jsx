"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import useUser from "@/utils/useUser";
import useHandleStreamResponse from "@/utils/useHandleStreamResponse";

export default function AIChatPage() {
  const { data: user, loading } = useUser();

  // NEW: choose Anthropic model integration for /ai/chat
  const integrationPath = "/integrations/anthropic-claude-haiku/";
  const modelLabel = "Claude Haiku";
  const modelLogName = "anthropic-claude-haiku";

  // OSINT-oriented system prompt for ShadowTrace
  const systemPrompt = useMemo(
    () =>
      [
        "You are ShadowTrace OSINT Copilot — a senior open-source intelligence analyst.",
        "You help the user interpret investigation results, connect evidence, and plan next steps.",
        "Rules:",
        "- Prefer evidence-backed claims and cite which dataset you relied on (AI analysis vs OSINT collection vs social posts vs Shodan).",
        "- Be explicit about uncertainty and suggest what to verify next.",
        "- Offer actionable follow-ups (what to search next, what to monitor, what to re-run).",
        "- If the user asks for something illegal (e.g. doxxing, private data access), refuse and offer safe alternatives.",
      ].join("\n"),
    [],
  );

  const [messages, setMessages] = useState([
    { role: "system", content: systemPrompt },
  ]);

  const [input, setInput] = useState("");
  const [error, setError] = useState(null);
  const [streamingMessage, setStreamingMessage] = useState("");
  const inputRef = useRef(null);
  // add: track request duration between send and finish
  const sendStartedAtRef = useRef(null);

  // NEW: dataset + context selection
  const [selectedInvestigationId, setSelectedInvestigationId] = useState(null);
  const [contextOptions, setContextOptions] = useState({
    includeInvestigationSummary: true,
    includeAI: true,
    includeOSINT: true,
    includeSocialPostsAnalytics: true,
    includeShodan: true,
    includeConfirmedData: true,
  });

  // Redirect unauthenticated users to sign in (client-only)
  useEffect(() => {
    if (!loading && !user) {
      // Fallback anchor will be shown below too
      if (typeof window !== "undefined") {
        window.location.href = "/account/signin";
      }
    }
  }, [user, loading]);

  // NEW: allow deep-linking to a case from /ai/chat?investigationId=123
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const invId = url.searchParams.get("investigationId");
    if (invId && !Number.isNaN(Number(invId))) {
      setSelectedInvestigationId(String(invId));
    }
  }, []);

  const lastAssistantMessage = useMemo(() => {
    const reversed = [...messages].reverse();
    const found = reversed.find((m) => m.role === "assistant");
    return found ? found.content : null;
  }, [messages]);

  // NEW: investigations list for dropdown
  const investigationsQuery = useQuery({
    queryKey: ["investigations", "all"],
    enabled: !!user,
    queryFn: async () => {
      const response = await fetch("/api/investigations?limit=all");
      if (!response.ok) {
        throw new Error(
          `When fetching /api/investigations, the response was [${response.status}] ${response.statusText}`,
        );
      }
      const data = await response.json();
      return Array.isArray(data?.investigations) ? data.investigations : [];
    },
  });

  // NEW: selected investigation detail
  const investigationDetailQuery = useQuery({
    queryKey: ["investigation", selectedInvestigationId],
    enabled: !!user && !!selectedInvestigationId,
    queryFn: async () => {
      const response = await fetch(
        `/api/investigations/${selectedInvestigationId}`,
      );
      if (!response.ok) {
        throw new Error(
          `When fetching /api/investigations/${selectedInvestigationId}, the response was [${response.status}] ${response.statusText}`,
        );
      }
      return response.json();
    },
  });

  const selectedInvestigation = investigationDetailQuery.data || null;

  const summarizedInvestigations = useMemo(() => {
    const rows = Array.isArray(investigationsQuery.data)
      ? investigationsQuery.data
      : [];
    return rows.slice(0, 12).map((r) => ({
      id: r.id,
      target_type: r.target_type,
      target_value: String(r.target_value || "").slice(0, 80),
      status: r.status,
      risk_score: r.risk_score ?? null,
      created_at: r.created_at,
    }));
  }, [investigationsQuery.data]);

  function safeStringify(obj, maxLen) {
    try {
      const txt = JSON.stringify(obj);
      if (typeof maxLen === "number" && txt.length > maxLen) {
        return txt.slice(0, maxLen) + "…(truncated)";
      }
      return txt;
    } catch {
      return "{}";
    }
  }

  const contextMessage = useMemo(() => {
    // Build a small, explicit context message for the model.
    const ctx = {
      app: "ShadowTrace",
      now: new Date().toISOString(),
      datasets: {
        recent_investigations: contextOptions.includeInvestigationSummary
          ? summarizedInvestigations
          : undefined,
      },
      selected_investigation: null,
    };

    if (selectedInvestigation && selectedInvestigation.id) {
      const ai = selectedInvestigation.ai_analysis || null;
      const confirmed = ai?.confirmed_data || null;

      // Pick the main OSINT envelope from osint_raw rows (row where target_type exists)
      const raw = Array.isArray(selectedInvestigation.osint_raw)
        ? selectedInvestigation.osint_raw
        : [];
      const osintEnvelope =
        raw
          .map((r) => r?.data_json)
          .find((dj) => dj && typeof dj === "object" && dj.target_type) ||
        (selectedInvestigation.osint_data &&
        typeof selectedInvestigation.osint_data === "object" &&
        selectedInvestigation.osint_data.target_type
          ? selectedInvestigation.osint_data
          : null);

      const socialAnalytics = raw
        .map((r) => r?.data_json)
        .find((dj) => dj?.type === "social_posts_analytics");

      // Shodan summary: only send the small bits we want the AI to reason about
      let shodanSummary = null;
      if (contextOptions.includeShodan) {
        const ips = osintEnvelope?.ip_network?.ips || [];
        const withShodan = ips
          .filter((ip) => ip?.shodan?.host)
          .slice(0, 5)
          .map((ip) => {
            const host = ip.shodan.host;
            const services = Array.isArray(host.services)
              ? host.services.slice(0, 25)
              : [];
            const openPorts = Array.isArray(host.ports) ? host.ports : [];
            const vulns = Array.isArray(host.vulns) ? host.vulns : [];
            return {
              ip: ip.ip,
              org: host.org || null,
              isp: host.isp || null,
              asn: host.asn || null,
              country: host.country_name || host.country || null,
              open_ports: openPorts.slice(0, 50),
              vulns: vulns.slice(0, 80),
              service_fingerprints: services.map((s) => ({
                port: s.port,
                transport: s.transport,
                product: s.product || null,
                version: s.version || null,
                http_title: s.http?.title || null,
                tls_cn: s.ssl?.cert?.subject?.CN || null,
                cpe: Array.isArray(s.cpe) ? s.cpe[0] : null,
              })),
            };
          });

        if (withShodan.length) {
          shodanSummary = { hosts: withShodan };
        }
      }

      ctx.selected_investigation = {
        id: selectedInvestigation.id,
        target_type: selectedInvestigation.target_type,
        target_value: selectedInvestigation.target_value,
        status: selectedInvestigation.status,
        created_at: selectedInvestigation.created_at,
        completed_at: selectedInvestigation.completed_at,
        ai: contextOptions.includeAI
          ? {
              risk_score:
                ai?.risk_score ?? selectedInvestigation.risk_score ?? null,
              verdict: ai?.verdict || null,
              key_findings: Array.isArray(ai?.key_findings)
                ? ai.key_findings.slice(0, 12)
                : [],
              action_log: Array.isArray(ai?.action_log)
                ? ai.action_log.slice(0, 12)
                : [],
              investigation_narrative:
                typeof ai?.investigation_narrative === "string"
                  ? ai.investigation_narrative.slice(0, 2500)
                  : null,
              connections_analysis: ai?.connections_analysis || null,
              pattern_of_life_analysis: ai?.pattern_of_life_analysis || null,
              legal_analysis: ai?.legal_analysis || null,
            }
          : undefined,
        confirmed_data: contextOptions.includeConfirmedData
          ? {
              emails: (confirmed?.emails || []).slice(0, 20),
              phones: (confirmed?.phones || []).slice(0, 20),
              domains: (confirmed?.domains || []).slice(0, 20),
              handles: (confirmed?.handles || []).slice(0, 20),
              profiles: (confirmed?.profiles || []).slice(0, 20),
            }
          : undefined,
        osint: contextOptions.includeOSINT
          ? {
              // keep only top-level slices that matter in chat
              breaches: osintEnvelope?.breaches || null,
              mentions: osintEnvelope?.mentions || null,
              deep_discovery: osintEnvelope?.deep_discovery || null,
              records: osintEnvelope?.records || null,
              crypto: osintEnvelope?.crypto || null,
              domain: osintEnvelope?.domain || null,
              ip_network: {
                ips: (osintEnvelope?.ip_network?.ips || [])
                  .slice(0, 12)
                  .map((i) => ({
                    ip: i.ip,
                    country: i.country || null,
                    org: i.org || null,
                    isp: i.isp || null,
                  })),
              },
              connections: osintEnvelope?.connections || null,
              discovered_urls: (osintEnvelope?.discovered_urls || []).slice(
                0,
                50,
              ),
            }
          : undefined,
        social_posts_analytics: contextOptions.includeSocialPostsAnalytics
          ? {
              analytics: socialAnalytics?.analytics || null,
              suspicious_patterns: socialAnalytics?.suspicious_patterns || [],
              posts_preview: Array.isArray(socialAnalytics?.posts)
                ? socialAnalytics.posts.slice(0, 25)
                : [],
            }
          : undefined,
        shodan: shodanSummary || undefined,
      };
    }

    const txt = safeStringify(ctx, 26000);
    return {
      role: "system",
      content:
        "CONTEXT (ShadowTrace datasets; may be truncated):\n" +
        txt +
        "\n\nWhen answering, explicitly reference parts of CONTEXT (e.g. selected_investigation.ai.key_findings).",
    };
  }, [
    selectedInvestigation,
    summarizedInvestigations,
    contextOptions,
    investigationsQuery.data,
  ]);

  const onFinish = useCallback(
    (finalContent) => {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: finalContent || streamingMessage },
      ]);
      // add: log assistant message with duration
      try {
        const duration = sendStartedAtRef.current
          ? Date.now() - sendStartedAtRef.current
          : null;
        logMutation.mutate({
          action: "assistant_message",
          content: finalContent || streamingMessage,
          duration_ms: duration,
          messages_count:
            messages.filter((m) => m.role !== "system").length + 1,
          model: modelLogName,
          extra: {
            selected_investigation_id: selectedInvestigationId || null,
            context_options: contextOptions,
          },
        });
      } catch (e) {
        // non-blocking
      }
      setStreamingMessage("");
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      streamingMessage,
      messages,
      selectedInvestigationId,
      contextOptions,
      modelLogName,
    ],
  );

  const handleStreamResponse = useHandleStreamResponse({
    onChunk: setStreamingMessage,
    onFinish,
  });

  // add: log mutation for ai chat usage
  const logMutation = useMutation({
    mutationFn: async (payload) => {
      try {
        await fetch("/api/ai/chat/log", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } catch (e) {
        // swallow logging errors
        console.error("ai chat log failed", e);
      }
    },
  });

  const sendMutation = useMutation({
    mutationFn: async (payload) => {
      setError(null);
      const res = await fetch(integrationPath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, stream: true }),
      });
      if (!res.ok) {
        throw new Error(
          `When calling Anthropic, the response was [${res.status}] ${res.statusText}`,
        );
      }
      return res;
    },
    onSuccess: (response) => {
      handleStreamResponse(response);
    },
    onError: (e) => {
      console.error(e);
      setError("Could not get a response from the AI");
    },
  });

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed) return;

    const userMessage = { role: "user", content: trimmed };

    // Keep a small rolling window so the model has context but we don't bloat tokens.
    const conversational = messages
      .filter((m) => m.role !== "system")
      .slice(-12);

    const outbound = [
      { role: "system", content: systemPrompt },
      contextMessage,
      ...conversational,
      userMessage,
    ];

    setMessages((prev) => [...prev, userMessage]);
    setInput("");

    // add: start timer and log user prompt
    sendStartedAtRef.current = Date.now();
    try {
      logMutation.mutate({
        action: "user_message",
        content: trimmed,
        prompt: trimmed,
        messages_count: outbound.filter((m) => m.role !== "system").length,
        model: modelLogName,
        extra: {
          selected_investigation_id: selectedInvestigationId || null,
          context_options: contextOptions,
        },
      });
    } catch (e) {
      // non-blocking
    }

    sendMutation.mutate({ messages: outbound });
    // Refocus for faster chatting
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, [
    input,
    messages,
    sendMutation,
    logMutation,
    systemPrompt,
    contextMessage,
    selectedInvestigationId,
    contextOptions,
    modelLogName,
  ]);

  const quickSend = useCallback((text) => {
    setInput(text);
    // small delay so state updates apply before send
    setTimeout(() => {
      try {
        if (inputRef.current) inputRef.current.focus();
      } catch {}
    }, 0);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#263043] text-white flex items-center justify-center">
        Loading...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#263043] text-white flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-[#2D384E] rounded-lg p-6 text-center">
          <div className="text-lg font-semibold mb-2">Please sign in</div>
          <div className="text-slate-300 mb-4">
            You need to sign in to use the AI chat.
          </div>
          <a
            href="/account/signin"
            className="inline-block px-4 py-2 rounded border border-[#37425B] hover:bg-[#37425B]"
          >
            Go to Sign In
          </a>
        </div>
      </div>
    );
  }

  const isSending = sendMutation.isLoading;
  const headerText = `OSINT Copilot (${modelLabel})`;

  const invSelectOptions = Array.isArray(investigationsQuery.data)
    ? investigationsQuery.data
    : [];

  const selectedLabel = selectedInvestigation
    ? `${selectedInvestigation.target_type}: ${String(selectedInvestigation.target_value || "").slice(0, 60)}`
    : "No case selected";

  return (
    <div className="min-h-screen bg-[#263043] text-white">
      <header className="border-b border-[#37425B]">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="font-semibold">{headerText}</div>
          <a
            href="/dashboard"
            className="text-sm px-3 py-1.5 border border-[#37425B] rounded hover:bg-[#37425B]"
          >
            Back to Dashboard
          </a>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-6 grid grid-cols-1 md:grid-cols-[320px_1fr] gap-6">
        {/* LEFT: context / tools */}
        <aside className="bg-[#2D384E] rounded-lg p-4 h-fit">
          <div className="text-sm font-semibold mb-2">Case context</div>
          <div className="text-xs text-slate-300 mb-3">
            Pick a case so the chat can use your investigation data.
          </div>

          <div className="space-y-3">
            <div>
              <div className="text-xs text-slate-300 mb-1">Selected case</div>
              <div className="text-xs text-slate-200 mb-2">{selectedLabel}</div>

              <select
                value={selectedInvestigationId || ""}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedInvestigationId(val || null);
                }}
                className="w-full bg-[#37425B] border border-[#37425B] rounded px-3 py-2 text-sm"
              >
                <option value="">No case</option>
                {invSelectOptions.slice(0, 200).map((inv) => {
                  const label = `${inv.target_type}: ${String(inv.target_value || "").slice(0, 45)}${inv.risk_score != null ? ` (risk ${inv.risk_score})` : ""}`;
                  return (
                    <option key={inv.id} value={String(inv.id)}>
                      {label}
                    </option>
                  );
                })}
              </select>

              {investigationsQuery.isLoading && (
                <div className="text-xs text-slate-400 mt-2">
                  Loading cases…
                </div>
              )}
              {investigationsQuery.error && (
                <div className="text-xs text-red-200 mt-2">
                  Could not load cases.
                </div>
              )}
              {investigationDetailQuery.isLoading &&
                selectedInvestigationId && (
                  <div className="text-xs text-slate-400 mt-2">
                    Loading case details…
                  </div>
                )}
              {investigationDetailQuery.error && selectedInvestigationId && (
                <div className="text-xs text-red-200 mt-2">
                  Could not load case details.
                </div>
              )}
            </div>

            <div className="border-t border-[#37425B] pt-3">
              <div className="text-xs text-slate-300 mb-2">
                Use these datasets
              </div>
              <div className="space-y-2 text-sm">
                {[
                  { key: "includeAI", label: "AI analysis" },
                  { key: "includeConfirmedData", label: "Confirmed data" },
                  { key: "includeOSINT", label: "OSINT collection" },
                  { key: "includeSocialPostsAnalytics", label: "Social posts" },
                  { key: "includeShodan", label: "Shodan intel" },
                ].map((opt) => {
                  const checked = !!contextOptions[opt.key];
                  return (
                    <label key={opt.key} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) =>
                          setContextOptions((prev) => ({
                            ...prev,
                            [opt.key]: e.target.checked,
                          }))
                        }
                      />
                      <span className="text-sm">{opt.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="border-t border-[#37425B] pt-3">
              <div className="text-xs text-slate-300 mb-2">Quick prompts</div>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() =>
                    quickSend(
                      "Summarize the selected investigation like an investigator briefing, and cite which evidence supports each point.",
                    )
                  }
                  className="text-left text-sm px-3 py-2 rounded border border-[#37425B] hover:bg-[#37425B]"
                >
                  Summarize case
                </button>
                <button
                  type="button"
                  onClick={() =>
                    quickSend(
                      "What are the highest-risk signals in this case? Give me 5 follow-up actions to validate or disprove them.",
                    )
                  }
                  className="text-left text-sm px-3 py-2 rounded border border-[#37425B] hover:bg-[#37425B]"
                >
                  Risk + next steps
                </button>
                <button
                  type="button"
                  onClick={() =>
                    quickSend(
                      "Review the social posts analytics and suspicious patterns. What do they suggest, and what would you monitor next?",
                    )
                  }
                  className="text-left text-sm px-3 py-2 rounded border border-[#37425B] hover:bg-[#37425B]"
                >
                  Social analysis
                </button>
                <button
                  type="button"
                  onClick={() =>
                    quickSend(
                      "Explain any Shodan findings (open ports, service fingerprints, known vulns) and what they might imply.",
                    )
                  }
                  className="text-left text-sm px-3 py-2 rounded border border-[#37425B] hover:bg-[#37425B]"
                >
                  Shodan analysis
                </button>
              </div>
            </div>

            {selectedInvestigationId && (
              <div className="border-t border-[#37425B] pt-3">
                <a
                  href={`/investigations/${selectedInvestigationId}`}
                  className="inline-block w-full text-center text-sm px-3 py-2 rounded border border-[#37425B] hover:bg-[#37425B]"
                >
                  Open case page
                </a>
              </div>
            )}
          </div>
        </aside>

        {/* RIGHT: chat */}
        <section className="space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/40 text-red-200 rounded p-3 text-sm">
              {error}
            </div>
          )}

          <div className="bg-[#2D384E] rounded-lg p-4 h-[60vh] overflow-y-auto">
            <div className="space-y-3">
              {messages
                .filter((m) => m.role !== "system")
                .map((m, idx) => {
                  const author = m.role === "user" ? "You" : "Assistant";
                  const bubbleColor =
                    m.role === "user" ? "bg-[#37425B]" : "bg-[#303B52]";
                  const content = m.content;
                  return (
                    <div key={idx} className="flex flex-col gap-1">
                      <div className="text-xs text-slate-400">{author}</div>
                      <div className={`rounded p-3 text-sm ${bubbleColor}`}>
                        {content}
                      </div>
                    </div>
                  );
                })}
              {streamingMessage && (
                <div className="flex flex-col gap-1">
                  <div className="text-xs text-slate-400">Assistant</div>
                  <div className="rounded p-3 text-sm bg-[#303B52] whitespace-pre-wrap">
                    {streamingMessage}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="bg-[#2D384E] rounded-lg p-3">
            <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-end">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="w-full bg-[#37425B] border border-[#37425B] rounded p-3 text-sm min-h-[80px]"
                placeholder={
                  selectedInvestigationId
                    ? "Ask about the selected case…"
                    : "Ask an OSINT question, or select a case to analyze…"
                }
                disabled={isSending}
              />
              <button
                onClick={handleSend}
                disabled={isSending || input.trim().length === 0}
                className="md:w-[160px] w-full px-4 py-2 rounded border border-[#37425B] hover:bg-[#37425B] disabled:opacity-70"
              >
                {isSending ? "Sending…" : "Send"}
              </button>
            </div>
            <div className="text-xs text-slate-400 mt-2">
              Tip: if results look stale, re-run the investigation and then ask
              again.
            </div>
          </div>

          {lastAssistantMessage && (
            <div className="text-xs text-slate-400">
              You can ask follow-ups like “what evidence supports that?” or
              “what’s the next best lead?”.
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
