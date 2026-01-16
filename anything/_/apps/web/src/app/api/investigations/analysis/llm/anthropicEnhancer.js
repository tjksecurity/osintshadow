export async function enhanceWithAI(
  osintData,
  heuristicAnalysis,
  options = {},
) {
  const timeoutMs =
    typeof options?.timeoutMs === "number" && Number.isFinite(options.timeoutMs)
      ? options.timeoutMs
      : 30000;

  // NEW: allow choosing the Anything integration/model (defaults to Haiku)
  const integrationKey =
    typeof options?.integration === "string" ? options.integration : null;

  const integrationPath =
    typeof options?.integrationPath === "string" && options.integrationPath
      ? options.integrationPath
      : integrationKey === "ANTHROPIC_CLAUDE_SONNET_3_5"
        ? "/integrations/anthropic-claude-sonnet-3-5/"
        : integrationKey === "ANTHROPIC_CLAUDE_SONNET"
          ? "/integrations/anthropic-claude-sonnet/"
          : integrationKey === "ANTHROPIC_CLAUDE_OPUS_4_1"
            ? "/integrations/anthropic-claude-opus-4-1/"
            : integrationKey === "ANTHROPIC_CLAUDE_HAIKU"
              ? "/integrations/anthropic-claude-haiku/"
              : "/integrations/anthropic-claude-haiku/";

  const llmProviderLabel = integrationPath
    .replace("/integrations/", "")
    .replaceAll("/", "");

  try {
    const prompt = [
      "You are an expert OSINT investigator. You have just completed a digital investigation on the provided target.",
      "Your goal is to write a detailed investigative report that sounds like it was written by a human specialist.",
      "Do NOT just summarize the data. Perform a deductive analysis:",
      "1. Narrative: Tell the story of the investigation. 'I started with... then I found... which led me to...'",
      "2. Key Findings: Isolate the most critical pieces of evidence (smoking guns, strong links). LOOK specifically for 'breaches' and 'records' in the data.",
      "3. Action Log: Reconstruct the logical steps taken based on the evidence found.",
      "4. Connections: Analyze family, friends, and associates found in 'connections' or social data.",
      "5. Pattern of Life: Analyze online/offline activity patterns, locations, and behavioral traits.",
      "6. Legal/Criminal: Analyze any court filings, criminal records, or property deeds found.",
      "7. Verdict: Assess the overall threat/credibility.",
      "8. Risk Score: 0-100.",
      "Only return JSON matching the provided schema.",
    ].join("\n");

    const body = {
      messages: [
        { role: "system", content: "You are a seasoned OSINT investigator." },
        {
          role: "user",
          content: `${prompt}\n\nOSINT DATA:\n${JSON.stringify(osintData).slice(0, 85000)}`,
        },
      ],
      json_schema: {
        name: "investigation_ai_report_v3",
        schema: {
          type: "object",
          properties: {
            investigation_narrative: { type: "string" },
            action_log: { type: "array", items: { type: "string" } },
            key_findings: { type: "array", items: { type: "string" } },
            connections_analysis: {
              type: "string",
              description: "Analysis of family, friends, and associates",
            },
            pattern_of_life_analysis: {
              type: "string",
              description:
                "Analysis of behavioral patterns, locations, and timestamps",
            },
            legal_analysis: {
              type: "string",
              description: "Analysis of court, criminal, and property records",
            },
            verdict: {
              type: "string",
              enum: ["Malicious", "Suspicious", "Safe", "Unknown"],
            },
            risk_score: { type: "integer" },
          },
          required: [
            "investigation_narrative",
            "action_log",
            "key_findings",
            "connections_analysis",
            "pattern_of_life_analysis",
            "legal_analysis",
            "verdict",
            "risk_score",
          ],
          additionalProperties: false,
        },
        strict: true,
      },
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let response;
    try {
      response = await fetch(integrationPath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      const errText = await response.text();
      console.error(
        `Anthropic integration error: [${response.status}] ${response.statusText}`,
        errText,
      );
      throw new Error(
        `Anthropic integration error: [${response.status}] ${response.statusText}`,
      );
    }

    const result = await response.json();
    const content = result?.choices?.[0]?.message?.content;
    let aiObject = null;
    try {
      aiObject = content ? JSON.parse(content) : null;
    } catch (e) {
      console.error("Failed to parse AI response content", content, e);
      aiObject = null;
    }

    if (aiObject && typeof aiObject === "object") {
      return {
        ...heuristicAnalysis,
        summary: aiObject.investigation_narrative ?? heuristicAnalysis.summary,
        investigation_narrative: aiObject.investigation_narrative,
        action_log: aiObject.action_log || [],
        key_findings: aiObject.key_findings || [],
        verdict: aiObject.verdict || "Unknown",
        anomalies: heuristicAnalysis.anomalies,
        risk_score: Number.isFinite(Number(aiObject.risk_score))
          ? Number(aiObject.risk_score)
          : heuristicAnalysis.risk_score,
        risk_level:
          (Number(aiObject.risk_score) > 70
            ? "high"
            : Number(aiObject.risk_score) > 40
              ? "medium"
              : "low") || heuristicAnalysis.risk_level,
        connections_analysis: aiObject.connections_analysis || null,
        pattern_of_life_analysis: aiObject.pattern_of_life_analysis || null,
        legal_analysis: aiObject.legal_analysis || null,
        llm_provider: llmProviderLabel,
      };
    }

    return heuristicAnalysis;
  } catch (err) {
    // AbortError happens when the request exceeds timeoutMs.
    if (err?.name === "AbortError") {
      console.warn(
        `AI enhancement timed out after ${timeoutMs}ms; using heuristic analysis`,
      );
      return heuristicAnalysis;
    }

    console.error("AI enhancement failed; using heuristic analysis", err);
    return heuristicAnalysis;
  }
}
