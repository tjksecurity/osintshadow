import { uniq, sum } from "../utils/helpers.js";

export function analyzeSocialFootprint(existingProfiles, associates) {
  const platformCount = existingProfiles.length;
  const followerCounts = existingProfiles
    .map((p) => p.followers)
    .filter((n) => Number.isFinite(Number(n)));
  const totalFollowers = sum(followerCounts);
  const activityLevel =
    platformCount >= 6
      ? "high"
      : platformCount >= 3
        ? "medium"
        : platformCount > 0
          ? "low"
          : "none";

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

  const suspiciousAssociates = associates.filter(
    (a) => a.risk_indicators?.length > 0,
  );

  const familyMembers = associates.filter(
    (a) => a.relationship_type === "family",
  );

  return {
    platforms_detected: platformCount,
    total_followers: totalFollowers,
    activity: activityLevel,
    top_platforms: uniq(existingProfiles.map((p) => p.platform)).slice(0, 10),
    nsfw_profiles: nsfwProfiles.map((p) => p.platform).slice(0, 10),
    evidence_backed_profiles: evidenceProfiles.map((p) => p.platform),
    associates_detected: associates.length,
    family_members: familyMembers.length,
    suspicious_associates: suspiciousAssociates.length,
  };
}
