import { safeFetch, searchDuckDuckGo } from "./helpers.js";

function extractTitle(html) {
  try {
    const m = html.match(/<title[^>]*>([^<]{1,200})<\/title>/i);
    if (m) return m[1].replace(/\s+/g, " ").trim();
  } catch {}
  return null;
}

function extractSnippet(html, needle) {
  try {
    const body = html.replace(/<[^>]+>/g, " ");
    const i = body.toLowerCase().indexOf(String(needle || "").toLowerCase());
    if (i !== -1) {
      const start = Math.max(0, i - 120);
      const end = Math.min(body.length, i + 120);
      return body.slice(start, end).replace(/\s+/g, " ").trim();
    }
  } catch {}
  return null;
}

const SOCIAL_HOSTS = [
  "x.com",
  "twitter.com",
  "www.reddit.com",
  "reddit.com",
  "old.reddit.com",
  "www.facebook.com",
  "facebook.com",
  "www.linkedin.com",
  "linkedin.com",
  "www.instagram.com",
  "instagram.com",
  "tiktok.com",
  "www.tiktok.com",
  "github.com",
  "gitlab.com",
  "medium.com",
  "stackoverflow.com",
];

function hostFromUrl(u) {
  try {
    return new URL(u).host.toLowerCase();
  } catch {
    return null;
  }
}

export async function mentionsIntel(targetType, targetValue, opts = {}) {
  const deep = !!opts.deepScan;
  const value = String(targetValue || "").trim();

  // IMPORTANT:
  // Non-deep mode must be fast and best-effort.
  // We return discovered links without fetching each page (page fetches are slow + often blocked).
  const queries = [];
  queries.push(`"${value}"`);

  if (targetType === "username") {
    queries.push(`${value} profile`);
  }

  // In deep mode we add more focused queries.
  if (deep) {
    queries.push(`site:twitter.com "${value}"`);
    queries.push(`site:x.com "${value}"`);
    queries.push(`site:reddit.com "${value}"`);
    queries.push(`site:github.com "${value}"`);
  }

  const Q = queries.slice(0, deep ? 6 : 2);
  const items = [];

  for (const q of Q) {
    const links = await searchDuckDuckGo(q, {
      maxLinks: deep ? 12 : 8,
      timeoutMs: deep ? 12000 : 8000,
      retries: deep ? 2 : 1,
    });

    for (const link of links) {
      const host = hostFromUrl(link);
      if (!host) continue;

      // Non-deep: do not fetch page HTML (fast path)
      if (!deep) {
        items.push({ url: link, title: null, snippet: null, host });
        if (items.length >= 20) break;
        continue;
      }

      // Deep mode: fetch a small number of pages for better titles/snippets.
      try {
        const r = await safeFetch(link, {
          timeoutMs: 8000,
          retries: 1,
        });
        if (!r.ok) continue;
        const html = await r.text();
        const title = extractTitle(html);
        const snippet = extractSnippet(html, value);
        items.push({ url: link, title, snippet, host });
        if (items.length >= 35) break;
      } catch {
        // ignore
      }
    }

    if (items.length >= (deep ? 35 : 20)) break;
  }

  const social = items.filter((i) => SOCIAL_HOSTS.includes(i.host));
  const web = items.filter((i) => !SOCIAL_HOSTS.includes(i.host));

  return {
    social: { items: social },
    web: { items: web },
    meta: {
      deep,
      queries_run: Q.length,
      total_items: items.length,
    },
  };
}
