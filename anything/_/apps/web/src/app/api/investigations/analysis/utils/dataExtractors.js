import { asArray } from "./helpers.js";

export function extractOsintModules(osintData) {
  return {
    emailInfo: osintData?.email || {},
    usernameInfo: osintData?.username || {},
    phoneInfo: osintData?.phone || {},
    domainInfo: osintData?.domain || {},
    ipNetInfo: osintData?.ip_network || {},
    socialInfo: osintData?.social || {},
    imagesInfo: osintData?.images || {},
    cryptoInfo: osintData?.crypto || {},
    breachesInfo: osintData?.breaches || {},
    mentionsInfo: osintData?.mentions || {},
    deepInfo: osintData?.deep_discovery || {},
    recordsInfo: osintData?.records || {},
  };
}

export function extractBaseIdentifiers(osintData, emailInfo, phoneInfo) {
  const baseEmail =
    osintData?.target_type === "email"
      ? osintData?.target_value
      : emailInfo?.address || null;
  const emailLocal = baseEmail ? String(baseEmail).split("@")[0] : null;
  const emailDomain = baseEmail ? String(baseEmail).split("@")[1] : null;

  const phoneSeeds = asArray(osintData?.phone_seeds)
    .map((p) => p?.digits || p)
    .filter(Boolean);

  return {
    baseEmail,
    emailLocal,
    emailDomain,
    phoneSeeds,
  };
}
