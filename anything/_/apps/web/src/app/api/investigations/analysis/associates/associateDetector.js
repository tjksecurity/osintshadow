export async function detectAssociates(osintData) {
  console.log("🔍 Starting associate detection analysis...");

  const associateMap = new Map();

  // Social profile enrichment
  // The OSINT collector stores username lookups under social.profiles (and username.profiles).
  const socialProfiles = Array.isArray(osintData?.social?.profiles)
    ? osintData.social.profiles
    : Array.isArray(osintData?.username?.profiles)
      ? osintData.username.profiles
      : [];

  for (const profile of socialProfiles) {
    // Some profiles include meta.bio or meta.display_name
    const bio = profile?.bio || profile?.meta?.bio || null;
    const display =
      profile?.display_name || profile?.meta?.display_name || null;

    // Extract names from bio/display_name (best-effort)
    const extractedNames = [
      ...extractNamesFromText(bio),
      ...extractNamesFromText(display),
    ];

    for (const name of extractedNames) {
      await processAssociate(associateMap, name, {
        source: `social_${String(profile?.platform || "unknown")}`,
        platform: profile?.platform || null,
        relationship_type: "mentioned_person",
        confidence: 0.35,
        context: `Mentioned in ${profile?.platform || "social"} profile text`,
      });
    }

    // If we saw cross-ref evidence that includes other usernames/emails, treat as potential associates.
    const evidence = profile?.match_evidence;
    if (evidence?.emails?.length) {
      for (const email of evidence.emails.slice(0, 10)) {
        if (
          String(email).toLowerCase() ===
          String(osintData?.target_value || "").toLowerCase()
        )
          continue;
        await processAssociate(associateMap, email, {
          source: `social_${String(profile?.platform || "unknown")}`,
          platform: profile?.platform || null,
          relationship_type: "co_located_contact",
          confidence: 0.55,
          context: `Email reference found on ${profile?.platform || "social"} page`,
        });
      }
    }

    if (evidence?.usernames?.length) {
      for (const u of evidence.usernames.slice(0, 10)) {
        if (
          String(u).toLowerCase() ===
          String(osintData?.target_value || "").toLowerCase()
        )
          continue;
        await processAssociate(associateMap, u, {
          source: `social_${String(profile?.platform || "unknown")}`,
          platform: profile?.platform || null,
          relationship_type: "social_connection",
          confidence: 0.45,
          context: `Username reference found on ${profile?.platform || "social"} page`,
        });
      }
    }
  }

  // Extract from directory/contact data
  if (osintData?.deep_discovery?.aggregate) {
    const { emails } = osintData.deep_discovery.aggregate;

    for (const email of emails || []) {
      const localPart = email.split("@")[0];
      if (localPart && localPart !== osintData.target_value) {
        await processAssociate(associateMap, email, {
          source: "directory_discovery",
          relationship_type: "co_located_contact",
          confidence: 0.7,
          context: "Found in same directory/contact listing",
        });
      }
    }
  }

  // Extract from records (court filings)
  if (Array.isArray(osintData?.records?.court_filings?.items)) {
    for (const filing of osintData.records.court_filings.items) {
      const parties = filing?.parties;

      // parties might be a string, array, or object depending on source.
      const partyNames = [];
      if (Array.isArray(parties)) {
        for (const p of parties) {
          if (typeof p === "string") partyNames.push(p);
          else if (p?.name) partyNames.push(p.name);
        }
      } else if (typeof parties === "string") {
        // crude split on vs / v.
        parties
          .split(/\sv\.?\s|\svs\.?\s|\sversus\s/i)
          .map((s) => s.trim())
          .filter(Boolean)
          .forEach((s) => partyNames.push(s));
      }

      for (const name of partyNames) {
        if (!name) continue;
        if (
          String(name).toLowerCase() ===
          String(osintData?.target_value || "").toLowerCase()
        )
          continue;

        await processAssociate(associateMap, name, {
          source: "court_records",
          relationship_type: "legal_connection",
          confidence: 0.8,
          context: `Co-party in court filing: ${filing?.docket_number || filing?.case_name || "unknown"}`,
          risk_indicators: filing?.risk_level
            ? [`Legal risk: ${filing.risk_level}`]
            : [],
        });
      }
    }
  }

  // Property records analysis (correct path: property_deeds)
  if (Array.isArray(osintData?.records?.property_deeds?.items)) {
    for (const property of osintData.records.property_deeds.items) {
      // Best-effort: if a deed includes multiple owners fields, treat the secondary owner as an associate.
      const owner2 = property?.owner2 || null;
      if (owner2) {
        await processAssociate(associateMap, owner2, {
          source: "property_records",
          relationship_type: "property_connection",
          confidence: 0.7,
          context: `Secondary owner listed for property: ${property?.address || "unknown"}`,
        });
      }
    }
  }

  // Family name analysis from email patterns
  if (osintData.target_type === "email") {
    const emailLocal = osintData.target_value.split("@")[0];
    const potentialFamily = detectFamilyFromEmail(emailLocal, osintData);
    for (const family of potentialFamily) {
      await processAssociate(associateMap, family.name, {
        source: "email_pattern_analysis",
        relationship_type: "family",
        confidence: family.confidence,
        context: family.reason,
      });
    }
  }

  return Array.from(associateMap.values());
}

async function processAssociate(associateMap, identifier, data) {
  const key = String(identifier).toLowerCase().trim();
  if (!key || key.length < 2) return;

  if (associateMap.has(key)) {
    const existing = associateMap.get(key);
    existing.sources.push(data.source);
    existing.confidence = Math.max(existing.confidence, data.confidence);
    existing.contexts.push(data.context);
    if (data.risk_indicators) {
      existing.risk_indicators = [
        ...(existing.risk_indicators || []),
        ...data.risk_indicators,
      ];
    }
  } else {
    associateMap.set(key, {
      name: identifier,
      relationship_type: data.relationship_type,
      confidence: data.confidence,
      sources: [data.source],
      contexts: [data.context],
      platform: data.platform || null,
      risk_indicators: data.risk_indicators || [],
      additional_data: data.additional_data || {},
      discovered_at: new Date().toISOString(),
    });
  }
}

function extractNamesFromText(text) {
  if (!text) return [];

  const namePattern = /\b([A-Z][a-z]{2,}\s+[A-Z][a-z]{2,})\b/g;
  const matches = [...text.matchAll(namePattern)];

  return matches
    .map((m) => m[1])
    .filter((name) => {
      const lower = name.toLowerCase();
      return ![
        "New York",
        "Los Angeles",
        "United States",
        "San Francisco",
        "Las Vegas",
      ].includes(name);
    });
}

function detectFamilyFromEmail(emailLocal, osintData) {
  const family = [];

  const parts = emailLocal.toLowerCase().split(/[._-]/);
  if (parts.length >= 2) {
    const [first, ...rest] = parts;
    const possibleLastName = rest[rest.length - 1];

    const commonFirstNames = [
      "john",
      "jane",
      "mike",
      "sarah",
      "david",
      "mary",
      "robert",
      "linda",
    ];
    for (const firstName of commonFirstNames) {
      if (firstName !== first) {
        family.push({
          name: `${firstName}.${possibleLastName}`,
          confidence: 0.3,
          reason: `Potential family member with same surname pattern`,
        });
      }
    }
  }

  return family;
}
