import { safeFetch, searchDuckDuckGo } from "../helpers.js";
import { MAX_RESULTS_PER_PLATFORM } from "./platformConfigs.js";

/**
 * Core search via DuckDuckGo site: queries with OG tag extraction
 */
export async function searchViaDDG(
  config,
  targetType,
  targetValue,
  usernameFromUrl,
) {
  const domains = config.domains || [];
  const siteQuery = domains.map((d) => `site:${d}`).join(" OR ");
  const q = `${siteQuery} ${targetType === "username" ? targetValue : '"' + targetValue + '"'}`;
  const links = await searchDuckDuckGo(q, { maxLinks: 10 });

  const profiles = [];
  for (const link of links) {
    try {
      const urlObj = new URL(link);
      if (!domains.some((d) => urlObj.hostname.toLowerCase().includes(d))) {
        continue;
      }

      const username = usernameFromUrl(link);
      if (!username) continue;

      const res = await safeFetch(link, { timeoutMs: 7000, retries: 1 });
      if (!res.ok) continue;
      const html = await res.text();
      const og = extractOg(html);

      const profile = {
        username,
        display_name: og.title || username,
        bio: og.description || null,
        profile_url: link,
        profile_image_url: og.image || null,
        verified: /verified|official/i.test(og.title || "") || false,
        followers_count: null,
        following_count: null,
        posts_count: null,
        metadata: {
          og,
          source: "ddg+og",
        },
      };

      profiles.push(profile);
      if (profiles.length >= MAX_RESULTS_PER_PLATFORM) break;
    } catch {
      // ignore per-link errors
    }
  }

  // ShadowTrace policy: no mock/synthetic fallbacks.
  // If nothing is found, return [].
  return profiles;
}

/**
 * Helper to extract OG tags from HTML
 */
function extractOg(html) {
  const pick = (re) => {
    const m = html.match(re);
    return m ? (m[1] || m[2] || "").trim() : null;
  };
  return {
    title:
      pick(
        /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
      ) || pick(/<title[^>]*>([^<]+)<\/title>/i),
    description: pick(
      /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i,
    ),
    image: pick(
      /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    ),
  };
}
