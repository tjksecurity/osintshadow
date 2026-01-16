import { uniq } from "../utils/helpers.js";

export function buildPresentation(
  osintData,
  riskScore,
  handles,
  existingProfiles,
  identityGraph,
  breachCount,
  criminalCount,
) {
  const nsfwProfiles = existingProfiles.filter(
    (p) =>
      p?.risk_hints?.nsfw_bio ||
      ["adult", "fetish"].includes(p?.platform_category),
  );

  const evidenceProfiles = existingProfiles.filter(
    (p) =>
      p?.match_evidence &&
      Object.values(p.match_evidence).some((a) => (a || []).length > 0),
  );

  const headline = `${osintData.target_value} — ${
    riskScore > 70 ? "High" : riskScore > 40 ? "Medium" : "Low"
  } risk, ${handles.length} handle(s), ${existingProfiles.length} social profile(s)`;

  const highlights = uniq([
    nsfwProfiles.length
      ? `${nsfwProfiles.length} NSFW/fetish profile(s) detected`
      : null,
    evidenceProfiles.length
      ? `${evidenceProfiles.length} profile(s) with on-page evidence`
      : null,
    identityGraph.phones.length
      ? `${identityGraph.phones.length} phone number(s) linked or discovered`
      : null,
    breachCount ? `${breachCount} known breach(es)` : null,
    criminalCount ? `${criminalCount} criminal record(s)` : null,
  ]).filter(Boolean);

  return {
    headline,
    highlights,
    evidence_profiles: evidenceProfiles.map((p) => ({
      platform: p.platform,
      url: p.profile_url,
      confidence: p.confidence,
    })),
    phone_numbers: identityGraph.phones,
  };
}
