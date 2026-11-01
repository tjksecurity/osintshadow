import { phoneDirectoriesSeed, hubDiscoverySeed } from "../directories.js";

export async function collectPhoneSeeds(data, crossRefs, targetType) {
  try {
    if (
      data.flags.include_web_scraping &&
      (targetType !== "username" || data.flags.include_deep_scan)
    ) {
      const seedArgs = {
        email: crossRefs.emails[0] || data.email?.address || null,
        username:
          data.username?.query ||
          data.username?.primary ||
          null ||
          crossRefs.usernames[0] ||
          null,
        domain:
          data.domain?.domain_info?.domain || crossRefs.domains[0] || null,
      };
      const seed = await phoneDirectoriesSeed(seedArgs, {
        deepScan: data.flags.include_deep_scan,
      });
      data.phone_seeds = seed.seedPhones || [];
      // Public-page candidates are intentionally not promoted into cross-source
      // correlation. A page mention is not evidence that this phone belongs to
      // the target, and using it as a search key can manufacture associations.
    }
  } catch {}
}

export async function collectHubDiscovery(data, crossRefs, targetType) {
  try {
    if (
      data.flags.include_web_scraping &&
      (targetType !== "username" || data.flags.include_deep_scan)
    ) {
      const seedArgs = {
        email: crossRefs.emails[0] || data.email?.address || null,
        username:
          data.username?.query ||
          data.username?.primary ||
          null ||
          crossRefs.usernames[0] ||
          null,
        domain:
          data.domain?.domain_info?.domain || crossRefs.domains[0] || null,
      };
      const discovery = await hubDiscoverySeed(seedArgs, {
        deepScan: data.flags.include_deep_scan,
      });
      const mergedPhones = [
        ...(data.phone_seeds || []),
        ...(discovery.seedPhones || []),
      ];

      const seenDigits = new Set();
      data.phone_seeds = [];
      for (const p of mergedPhones) {
        if (!seenDigits.has(p.digits)) {
          seenDigits.add(p.digits);
          data.phone_seeds.push(p);
        }
      }
      data.email_seeds = discovery.seedEmails || [];
      data.discovered_urls = discovery.discoveredUrls || [];

      crossRefs.emails.push(...(data.email_seeds || []).map((e) => e.email));
    }
  } catch {}
}
