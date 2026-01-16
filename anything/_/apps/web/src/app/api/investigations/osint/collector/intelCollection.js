import { breachIntel } from "../breach.js";
import { mentionsIntel } from "../mentions.js";
import { deepWebDiscovery } from "../deepweb.js";

export async function collectBreachIntel(targetType, targetValue, data) {
  if (["email", "username", "phone", "domain"].includes(targetType)) {
    data.breaches = await breachIntel(targetType, targetValue, {
      deepScan: data.flags.include_deep_scan,
    });
  }
}

export async function collectMentionsIntel(targetType, targetValue, data) {
  if (data.flags.include_web_scraping) {
    data.mentions = await mentionsIntel(targetType, targetValue, {
      deepScan: data.flags.include_deep_scan,
    });

    const mentionUrls = [
      ...(data.mentions?.social?.items || []).map((i) => i.url),
      ...(data.mentions?.web?.items || []).map((i) => i.url),
    ];
    data.discovered_urls = Array.from(
      new Set([...(data.discovered_urls || []), ...mentionUrls]),
    ).slice(0, data.flags.include_deep_scan ? 500 : 200);
  }
}

export async function collectDeepWebDiscovery(data) {
  if (data.flags.include_web_scraping) {
    const seeds = new Set([
      ...(data.discovered_urls || []),
      ...((data.breaches?.open_web?.items || []).map((i) => i.url) || []),
    ]);

    const deep = await deepWebDiscovery(Array.from(seeds), {
      deepScan: data.flags.include_deep_scan,
      maxPages: data.flags.include_deep_scan ? 18 : 6,
      maxTimeMs: data.flags.include_deep_scan ? 60_000 : 12_000,
      concurrency: data.flags.include_deep_scan ? 4 : 3,
    });
    data.deep_discovery = deep;

    const moreEmails = (deep.aggregate?.emails || [])
      .slice(0, 50)
      .map((e) => ({ email: e }));
    data.email_seeds = Array.from(
      new Map(
        [...(data.email_seeds || []), ...moreEmails].map((e) => [e.email, e]),
      ).values(),
    );

    return moreEmails;
  }
  return [];
}
