import { clamp } from "../utils/helpers.js";

export function calculateRiskScore(
  osintData,
  emailInfo,
  breachExposure,
  locationCoherence,
  existingProfiles,
  associates,
  recordsInfo,
  deepInfo,
  cryptoProfile,
) {
  const riskFactors = [];
  let riskScore = 0;

  // Breach signals
  const breachCount = breachExposure.breach_count;
  if (breachCount >= 5) {
    riskFactors.push(`Multiple breaches detected (${breachCount} incidents)`);
  } else if (breachCount > 0) {
    riskFactors.push(`Data breaches detected (${breachCount})`);
  }
  if (breachCount > 0) {
    riskScore += clamp(breachCount * 5, 0, 50);
  }

  // Deep discovery signals
  const deepEmailsCount = (deepInfo?.aggregate?.emails || []).length;
  const deepPhonesCount = (deepInfo?.aggregate?.phones || []).length;
  if (deepEmailsCount > 0 || deepPhonesCount > 0) {
    riskFactors.push(
      `Deep web scraping found ${deepEmailsCount} emails and ${deepPhonesCount} phones`,
    );
    riskScore += 10;
  }

  // Records signals
  const criminalCount = (recordsInfo?.criminal?.items || []).length;
  const courtCount = (recordsInfo?.court_filings?.items || []).length;
  if (criminalCount > 0) {
    riskFactors.push(
      `Criminal records potential match found (${criminalCount})`,
    );
    riskScore += 40;
  }
  if (courtCount > 0) {
    riskFactors.push(`Court filings found (${courtCount})`);
    riskScore += 20;
  }

  // Location inconsistency
  if (
    !locationCoherence.consistent &&
    locationCoherence.unique_countries.length > 1
  ) {
    riskFactors.push("Location inconsistency across IP/phone/EXIF");
    riskScore += 15;
  }

  // NSFW profiles
  const nsfwProfiles = existingProfiles.filter(
    (p) =>
      p?.risk_hints?.nsfw_bio ||
      ["adult", "fetish"].includes(p?.platform_category),
  );
  if (nsfwProfiles.length) {
    riskFactors.push("Adult/fetish profiles detected");
    riskScore += Math.min(20, nsfwProfiles.length * 5);
  }

  // Associate-based risk
  const suspiciousAssociates = associates.filter(
    (a) => a.risk_indicators?.length > 0,
  );
  if (suspiciousAssociates.length > 0) {
    riskFactors.push(
      `${suspiciousAssociates.length} associate(s) with risk indicators`,
    );
    riskScore += Math.min(30, suspiciousAssociates.length * 8);
  }

  // Family members
  const familyMembers = associates.filter(
    (a) => a.relationship_type === "family",
  );
  if (familyMembers.length > 0) {
    riskFactors.push(`${familyMembers.length} family member(s) identified`);
  }

  // Crypto activity
  if (cryptoProfile && cryptoProfile.activity_level === "high") {
    riskFactors.push("High on-chain activity detected");
    riskScore += 10;
  }

  // Disposable email
  const isDisposable =
    osintData.email?.is_disposable || emailInfo?.is_disposable;
  if (isDisposable) {
    riskFactors.push("Uses disposable email service");
    riskScore += 30;
  }

  // Invalid email format
  if (osintData.email && osintData.email.validation?.format_valid === false) {
    riskFactors.push("Invalid email format");
    riskScore += 20;
  }

  riskScore = clamp(riskScore, 0, 100);

  return {
    riskFactors,
    riskScore: Math.round(riskScore),
    riskLevel: riskScore > 70 ? "high" : riskScore > 40 ? "medium" : "low",
    verdict:
      riskScore > 70 ? "Malicious" : riskScore > 40 ? "Suspicious" : "Safe",
  };
}
