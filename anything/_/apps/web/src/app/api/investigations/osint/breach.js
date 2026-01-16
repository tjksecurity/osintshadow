import { safeFetch, searchDuckDuckGo } from "./helpers.js";

function isEmail(value) {
  return /.+@.+\..+/.test(String(value || ""));
}

function decodeDuckUrl(u) {
  try {
    const url = new URL(u, "https://duckduckgo.com");
    const uddg = url.searchParams.get("uddg");
    return uddg ? decodeURIComponent(uddg) : u;
  } catch {
    return u;
  }
}

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

export async function breachIntel(targetType, targetValue, opts = {}) {
  const deep = !!opts.deepScan;
  const out = {
    provider: { hibp: false },
    hibp: { items: [], error: null },
    open_web: { items: [], error: null },
  };

  const value = String(targetValue || "").trim();

  // Try HaveIBeenPwned for emails (best source)
  if (isEmail(value)) {
    const key = process.env.HIBP_API_KEY;
    if (key) {
      try {
        const url = `https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(
          value,
        )}?truncateResponse=false`;
        const res = await safeFetch(url, {
          headers: {
            "hibp-api-key": key,
            "User-Agent": "ShadowTrace/1.0 (breachIntel)",
          },
          timeoutMs: 12000,
          retries: 1,
        });
        if (res.status === 404) {
          out.provider.hibp = true; // queried successfully but none
          out.hibp.items = [];
        } else if (res.ok) {
          const data = await res.json();
          out.provider.hibp = true;
          out.hibp.items = (Array.isArray(data) ? data : []).map((b) => ({
            source: "hibp",
            name: b.Name,
            domain: b.Domain,
            breach_date: b.BreachDate,
            added_date: b.AddedDate,
            verified: b.IsVerified,
            sensitive: b.IsSensitive,
            data_classes: b.DataClasses,
            logo_path: b.LogoPath,
          }));
        } else if (res.status === 401) {
          out.hibp.error = "HIBP key invalid";
        } else {
          out.hibp.error = `HIBP error ${res.status}`;
        }
      } catch (e) {
        out.hibp.error = e.message;
      }
    }
  }

  // Open web discovery (emails, usernames, phones)
  // IMPORTANT: in non-deep mode we do NOT fetch every result page (slow + often blocked).
  // We return discovered URLs only.
  try {
    const queries = new Set();
    if (isEmail(value)) {
      queries.add(`\"${value}\" breach`);
      queries.add(`\"${value}\" leak`);
      queries.add(`site:pastebin.com \"${value}\"`);
      queries.add(`\"${value}\" password`);
    } else if (targetType === "username") {
      queries.add(`\"${value}\" breach`);
      queries.add(`\"${value}\" leak`);
      queries.add(`site:pastebin.com \"${value}\"`);
      queries.add(`site:github.com \"${value}\" token`);
    } else if (targetType === "phone") {
      const digits = value.replace(/\D/g, "");
      if (digits) {
        queries.add(`\"${digits}\" breach`);
        queries.add(`\"${digits}\" leak`);
        queries.add(`site:pastebin.com \"${digits}\"`);
      }
    } else if (targetType === "domain") {
      queries.add(`site:pastebin.com \"${value}\"`);
      queries.add(`\"${value}\" breach`);
    }

    const Q = Array.from(queries).slice(0, deep ? 6 : 3);
    const results = [];

    for (const q of Q) {
      const links = await searchDuckDuckGo(q, {
        maxLinks: deep ? 10 : 8,
        timeoutMs: deep ? 12000 : 8000,
        retries: deep ? 2 : 1,
      });

      for (const link of links) {
        if (!link) continue;

        // Non-deep: no page fetch
        if (!deep) {
          results.push({
            source: "web",
            url: link,
            title: null,
            snippet: null,
          });
          if (results.length >= 15) break;
          continue;
        }

        // Deep: fetch a small sample for title/snippet
        try {
          const r = await safeFetch(link, {
            timeoutMs: 8000,
            retries: 1,
          });
          if (!r.ok) continue;
          const html = await r.text();
          const title = extractTitle(html);
          const snippet = extractSnippet(html, value);
          results.push({ source: "web", url: link, title, snippet });
          if (results.length >= 25) break;
        } catch {
          // ignore
        }
      }

      if (results.length >= (deep ? 25 : 15)) break;
    }

    out.open_web.items = results;
  } catch (e) {
    out.open_web.error = e.message;
  }

  return out;
}
