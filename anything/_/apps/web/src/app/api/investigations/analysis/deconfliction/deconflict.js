function normalizeText(v) {
  return String(v || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function asNonEmptyString(v) {
  const s = String(v || "").trim();
  return s ? s : null;
}

function classifyStrength(source) {
  const name = String(source?.name || "").toLowerCase();
  const kind = String(source?.kind || "").toLowerCase();

  if (kind === "user_input") return 3;
  if (name.includes("estated")) return 3;
  if (kind === "plate_provider") return 2;
  if (kind === "social_profile") {
    const confidence = Number(source?.confidence || 0);
    if (Number.isFinite(confidence) && confidence >= 70) return 3;
    if (Number.isFinite(confidence) && confidence >= 50) return 2;
    return 1;
  }
  if (name.includes("courtlistener")) return 2;
  if (name.includes("trellis")) return 1;
  if (name.includes("web search")) return 1;
  return 1;
}

function addAssertion(assertionsByField, fieldKey, value, source) {
  const cleaned = asNonEmptyString(value);
  if (!cleaned) return;

  const normalized = normalizeText(cleaned);
  if (!normalized) return;

  if (!assertionsByField[fieldKey]) assertionsByField[fieldKey] = [];
  assertionsByField[fieldKey].push({
    value: cleaned,
    normalized,
    source: {
      name: source?.name || null,
      url: source?.url || null,
      kind: source?.kind || null,
      confidence: source?.confidence ?? null,
    },
    strength: classifyStrength(source),
  });
}

function buildConflictsForField(fieldKey, assertions, { singular }) {
  if (!assertions?.length) return [];

  // group by normalized value
  const groups = new Map(); // normalized -> { value, sources: [], strengthSum }
  for (const a of assertions) {
    if (!groups.has(a.normalized)) {
      groups.set(a.normalized, {
        value: a.value,
        normalized: a.normalized,
        sources: [],
        strengthSum: 0,
        strongest: 0,
      });
    }
    const g = groups.get(a.normalized);
    g.sources.push(a.source);
    g.strengthSum += a.strength;
    g.strongest = Math.max(g.strongest, a.strength);
  }

  const groupList = Array.from(groups.values()).sort(
    (a, b) => b.strengthSum - a.strengthSum,
  );

  // If field is not singular, we don't mark "multiple values" as conflict.
  if (!singular) {
    return [];
  }

  // determine how many "strong" competing values exist
  const strongGroups = groupList.filter((g) => g.strongest >= 2);

  if (strongGroups.length < 2) {
    return [];
  }

  const topA = strongGroups[0];
  const topB = strongGroups[1];

  let severity = "low";
  if (topA.strongest >= 3 && topB.strongest >= 3) severity = "high";
  else if (topA.strongest >= 3 && topB.strongest >= 2) severity = "medium";

  return [
    {
      field_key: fieldKey,
      conflict_type: "VALUE_MISMATCH",
      severity,
      summary: `Conflicting ${fieldKey} values across sources`,
      values: strongGroups.slice(0, 6).map((g) => ({
        value: g.value,
        sources: g.sources.slice(0, 10),
        strength_sum: g.strengthSum,
      })),
    },
  ];
}

export function computeDeconfliction(osintData, socialProfiles = []) {
  const assertionsByField = {};

  // --- names ---
  if (osintData?.target_type === "name") {
    addAssertion(assertionsByField, "name", osintData?.target_value, {
      kind: "user_input",
      name: "User input",
      url: null,
    });
  }

  // social profile display names (if present)
  for (const p of socialProfiles || []) {
    const confidencePct =
      typeof p?.risk_score === "number"
        ? p.risk_score
        : typeof p?.confidence_score === "number"
          ? Math.round(p.confidence_score * 100)
          : null;

    addAssertion(assertionsByField, "name", p?.display_name, {
      kind: "social_profile",
      name: `Social (${p?.platform || "unknown"})`,
      url: p?.profile_url || null,
      confidence: confidencePct,
    });
  }

  // property deeds owners
  const deeds = osintData?.records?.property_deeds?.items || [];
  for (const d of deeds) {
    const src = d?.source || {};
    addAssertion(assertionsByField, "name", d?.owner, {
      kind: "property_record",
      name: src?.name || "Property record",
      url: src?.url || null,
    });
    addAssertion(assertionsByField, "name", d?.owner2, {
      kind: "property_record",
      name: src?.name || "Property record",
      url: src?.url || null,
    });
    addAssertion(assertionsByField, "name", d?.buyer, {
      kind: "property_record",
      name: src?.name || "Property record",
      url: src?.url || null,
    });
    addAssertion(assertionsByField, "name", d?.seller, {
      kind: "property_record",
      name: src?.name || "Property record",
      url: src?.url || null,
    });
  }

  // license plate owner
  const plates = osintData?.records?.license_plates?.items || [];
  for (const item of plates) {
    addAssertion(assertionsByField, "name", item?.owner?.name, {
      kind: "plate_provider",
      name: item?.source?.name || "Plate Provider",
      url: item?.source?.url || null,
    });
  }

  // --- addresses ---
  if (osintData?.target_type === "address") {
    addAssertion(assertionsByField, "address", osintData?.target_value, {
      kind: "user_input",
      name: "User input",
      url: null,
    });
  }

  for (const d of deeds) {
    const src = d?.source || {};
    addAssertion(assertionsByField, "address", d?.address, {
      kind: "property_record",
      name: src?.name || "Property record",
      url: src?.url || null,
    });
  }

  // --- domains (usually plural; not a conflict) ---
  // --- emails/phones (usually plural; not a conflict) ---

  const fieldConfig = [
    { key: "name", singular: true },
    { key: "address", singular: true },
  ];

  const conflicts = [];
  for (const cfg of fieldConfig) {
    const assertions = assertionsByField[cfg.key] || [];
    conflicts.push(
      ...buildConflictsForField(cfg.key, assertions, {
        singular: cfg.singular,
      }),
    );
  }

  const counts = {
    total: conflicts.length,
    high: conflicts.filter((c) => c.severity === "high").length,
    medium: conflicts.filter((c) => c.severity === "medium").length,
    low: conflicts.filter((c) => c.severity === "low").length,
  };

  return {
    type: "deconfliction",
    generated_at: new Date().toISOString(),
    counts,
    conflicts,
  };
}
