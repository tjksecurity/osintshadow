import { searchDuckDuckGo } from "./helpers.js";

/**
 * findConnections(name, options)
 *
 * Uses web search heuristics to identify potential family members,
 * close friends, and associates.
 *
 * @param {string} name - Target's full name
 * @param {object} opts - Options
 * @returns {object} { family: [], friends: [], associates: [] }
 */
export async function findConnections(name, opts = {}) {
  const data = {
    family: [],
    friends: [],
    associates: [],
    discovered_urls: [],
  };

  if (!name || name.trim().length < 3) return data;

  const queries = [
    `"${name}" obituary survivors`, // Survivors often listed in obituaries
    `"${name}" family members`, // Generic people search hits
    `"${name}" relatives`,
    `site:facebook.com "${name}" friends`, // Public friend lists
    `site:linkedin.com "${name}" connections`, // Professional connections
    `"${name}" business partner`, // Associates
    `"${name}" associate`,
  ];

  try {
    const promises = queries.map((q) =>
      searchDuckDuckGo(q, { maxLinks: opts.deepScan ? 8 : 4 }),
    );
    const results = await Promise.all(promises);

    // Flatten and unique
    const links = Array.from(new Set(results.flat()));
    data.discovered_urls = links;

    // We can't easily parse names from raw HTML without heavy NLP or specialized scrapers,
    // so we return the URLs as evidence. The AI analysis step will parse these snippets.
    // However, we can categorize the URLs based on keywords.

    for (const url of links) {
      const lower = url.toLowerCase();
      if (lower.includes("obituary") || lower.includes("funeral")) {
        data.family.push({ url, type: "obituary_mention" });
      } else if (
        lower.includes("facebook.com") ||
        lower.includes("instagram.com")
      ) {
        data.friends.push({ url, type: "social_connection" });
      } else if (lower.includes("linkedin.com")) {
        data.associates.push({ url, type: "professional_connection" });
      } else {
        // Generic bucket
        data.associates.push({ url, type: "possible_connection" });
      }
    }
  } catch (e) {
    console.error("Connection search failed", e);
  }

  return data;
}
