import { uniq } from "../utils/helpers.js";

export function analyzeLocationCoherence(ipNetInfo, phoneInfo, imagesInfo) {
  const ipCountries = uniq(
    (ipNetInfo?.ips || []).map((i) => i?.geo?.country).filter(Boolean),
  );
  const phoneCountry = phoneInfo?.region?.country || null;
  const exifCountries = uniq(
    (imagesInfo?.exif || []).map((e) => e?.country).filter(Boolean),
  );

  const allCountries = uniq(
    [...(ipCountries || []), phoneCountry, ...(exifCountries || [])].filter(
      Boolean,
    ),
  );

  const locationCoherence = {
    sources: {
      ip_countries: ipCountries,
      phone_country: phoneCountry,
      exif_countries: exifCountries,
    },
    unique_countries: allCountries,
    consistent: allCountries.length <= 1,
    issues: [],
  };

  if (!locationCoherence.consistent && allCountries.length > 1) {
    locationCoherence.issues.push("Inconsistent countries across sources");
  }

  return locationCoherence;
}
