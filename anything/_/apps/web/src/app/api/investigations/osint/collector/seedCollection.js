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
      crossRefs.phones.push(
        ...data.phone_seeds.map((p) => `+${p.digits}`.replace(/^\+\+/, "+")),
      );
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

      crossRefs.phones.push(
        ...data.phone_seeds.map((p) => `+${p.digits}`.replace(/^\+\+/, "+")),
      );
      crossRefs.emails.push(...(data.email_seeds || []).map((e) => e.email));
    }
  } catch {}
}
