import { uniq, clamp } from "../utils/helpers.js";

export function analyzeBreachExposure(emailInfo, breachesInfo) {
  const legacyBreachCount = Number(emailInfo?.breach?.breach_count || 0);
  const legacyBreachedDomains = emailInfo?.breach?.breached_domains || [];

  const hibpItems = breachesInfo?.hibp?.items || [];
  const openWebBreaches = breachesInfo?.open_web?.items || [];

  const allBreachedDomains = uniq([
    ...legacyBreachedDomains,
    ...hibpItems.map((b) => b.domain || b.name),
    ...openWebBreaches.map((b) => b.title),
  ]);

  const breachCount = Math.max(
    legacyBreachCount,
    hibpItems.length + (openWebBreaches.length > 0 ? 1 : 0),
  );

  const firstBreach =
    hibpItems.map((b) => b.breach_date).sort()[0] ||
    emailInfo?.breach?.first_breach_date ||
    null;

  const newestBreach =
    hibpItems
      .map((b) => b.breach_date)
      .sort()
      .reverse()[0] ||
    emailInfo?.breach?.newest_breach_date ||
    null;

  let exposureScore = clamp(breachCount * 12, 0, 80);
  if (breachCount > 0) {
    exposureScore = clamp(exposureScore + 10, 0, 100);
  }

  return {
    breach_count: breachCount,
    breached_domains: allBreachedDomains,
    first_breach_date: firstBreach,
    newest_breach_date: newestBreach,
    exposure_score: Math.round(exposureScore),
    details: {
      hibp: hibpItems,
      open_web: openWebBreaches,
    },
  };
}
