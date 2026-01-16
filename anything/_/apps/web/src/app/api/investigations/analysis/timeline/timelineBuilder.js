export async function buildTimeline(osintData, associates) {
  console.log("📅 Building investigation timeline...");

  const events = [];

  // Add breach events
  if (osintData?.breaches?.hibp?.items) {
    for (const breach of osintData.breaches.hibp.items) {
      const ts = breach?.breach_date ? new Date(breach.breach_date) : null;
      if (!ts || Number.isNaN(ts.getTime())) continue;

      events.push({
        timestamp: ts,
        event_type: "data_breach",
        title: `Data breach at ${breach.name}`,
        description: `Email found in ${breach.name} data breach`,
        source: "HIBP",
        severity: "high",
        details: {
          breach_name: breach.name,
          compromised_data: breach.data_classes,
          verified: breach.is_verified,
        },
      });
    }
  }

  // Social profile events (NO MOCK DATES)
  // Use OSINT's normalized profiles under social.profiles.
  const socialProfiles = Array.isArray(osintData?.social?.profiles)
    ? osintData.social.profiles
    : [];

  for (const p of socialProfiles) {
    if (!p?.exists) continue;

    // We only add a timeline event if we have a real date signal.
    const lastActive = p?.last_active ? new Date(p.last_active) : null;
    const createdAt = p?.account_created_date
      ? new Date(p.account_created_date)
      : null;

    const timestamp =
      lastActive && !Number.isNaN(lastActive.getTime())
        ? lastActive
        : createdAt && !Number.isNaN(createdAt.getTime())
          ? createdAt
          : null;

    if (!timestamp) continue;

    const platform = p?.platform || "social";
    const handle = p?.username || "Unknown";

    events.push({
      timestamp,
      event_type: lastActive ? "account_activity" : "account_creation",
      title: lastActive
        ? `${platform} activity observed`
        : `${platform} account created`,
      description: `${platform} profile: ${handle}`,
      source: platform,
      severity: "info",
      details: {
        platform,
        username: handle,
        confidence: p?.confidence,
        profile_url: p?.profile_url,
      },
    });
  }

  // Court/legal events (support FreeLawProject + Trellis shape)
  const filings = Array.isArray(osintData?.records?.court_filings?.items)
    ? osintData.records.court_filings.items
    : [];

  for (const filing of filings) {
    const ts = filing?.date_filed ? new Date(filing.date_filed) : null;
    if (!ts || Number.isNaN(ts.getTime())) continue;

    const caseName = filing?.case_name || "Court filing";
    const court = filing?.court || "Court";
    const riskLevel = (filing?.risk_level || "").toLowerCase();

    const severity =
      riskLevel === "high"
        ? "high"
        : riskLevel === "medium"
          ? "medium"
          : "info";

    events.push({
      timestamp: ts,
      event_type: "legal_event",
      title: `Court filing: ${caseName}`,
      description: `${court}${filing?.docket_number ? ` • ${filing.docket_number}` : ""}`,
      source: filing?.source || "Court Records",
      severity,
      details: {
        docket_number: filing?.docket_number || null,
        court: filing?.court || null,
        role: filing?.role || null,
        risk_level: filing?.risk_level || null,
        url: filing?.url || null,
      },
    });
  }

  // Add associate discovery events
  for (const associate of associates) {
    const ts = associate?.discovered_at
      ? new Date(associate.discovered_at)
      : null;
    if (!ts || Number.isNaN(ts.getTime())) continue;

    events.push({
      timestamp: ts,
      event_type: "associate_discovery",
      title: `Associate identified: ${associate.name}`,
      description: `${associate.relationship_type} connection discovered`,
      source: associate.sources?.[0] || "analysis",
      severity: associate.risk_indicators?.length > 0 ? "medium" : "low",
      details: {
        relationship_type: associate.relationship_type,
        confidence: associate.confidence,
        sources: associate.sources,
        risk_indicators: associate.risk_indicators,
      },
    });
  }

  // Sort chronologically
  events.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  const timelineAnalysis = analyzeTimeline(events);

  return {
    events,
    analysis: timelineAnalysis,
    total_events: events.length,
    date_range: {
      earliest: events.length > 0 ? events[0].timestamp : null,
      latest: events.length > 0 ? events[events.length - 1].timestamp : null,
    },
  };
}

function analyzeTimeline(events) {
  const analysis = {
    patterns: [],
    clusters: [],
    anomalies: [],
  };

  // Detect clustering of events
  const eventsByYear = {};
  for (const event of events) {
    const year = new Date(event.timestamp).getFullYear();
    if (!eventsByYear[year]) eventsByYear[year] = [];
    eventsByYear[year].push(event);
  }

  // Find years with unusual activity
  const avgEventsPerYear = events.length / Object.keys(eventsByYear).length;
  for (const [year, yearEvents] of Object.entries(eventsByYear)) {
    if (yearEvents.length > avgEventsPerYear * 2) {
      analysis.clusters.push({
        year: parseInt(year),
        event_count: yearEvents.length,
        description: `High activity period: ${yearEvents.length} events in ${year}`,
        events: yearEvents.map((e) => e.event_type),
      });
    }
  }

  // Detect patterns
  const breachEvents = events.filter((e) => e.event_type === "data_breach");
  if (breachEvents.length >= 3) {
    analysis.patterns.push({
      type: "multiple_breaches",
      description: `Subject appeared in ${breachEvents.length} data breaches`,
      severity: "high",
    });
  }

  return analysis;
}
