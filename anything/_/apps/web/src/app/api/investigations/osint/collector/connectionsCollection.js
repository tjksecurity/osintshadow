import { findConnections } from "../connections.js";

export async function collectConnections(targetType, targetValue, data) {
  try {
    if (data.flags.include_connections) {
      const query =
        targetType === "name"
          ? targetValue
          : targetType === "username"
            ? targetValue
            : targetType === "email"
              ? targetValue.split("@")[0]
              : null;

      if (query) {
        const conns = await findConnections(query, {
          deepScan: data.flags.include_deep_scan,
        });
        data.connections = conns;

        if (conns.discovered_urls?.length) {
          data.discovered_urls = Array.from(
            new Set([
              ...(data.discovered_urls || []),
              ...conns.discovered_urls,
            ]),
          );
        }
      }
    }
  } catch (e) {
    // non-fatal
  }
}

export function seedDiscoveredUrlsFromProfiles(data) {
  try {
    const profs = Array.isArray(data.username?.profiles)
      ? data.username.profiles
      : [];
    const urls = profs
      .filter((p) => p?.exists && p?.profile_url)
      .map((p) => p.profile_url);
    if (urls.length) {
      data.discovered_urls = Array.from(
        new Set([...(data.discovered_urls || []), ...urls]),
      ).slice(0, data.flags.include_deep_scan ? 500 : 200);
    }
  } catch {}
}
