import { safeFetch } from "./helpers.js";

// Generate common display variants for a phone number to improve web matching
function phoneDisplayVariants(normalized) {
  if (!normalized) return [];
  const digits = normalized.replace(/\D/g, "");
  if (!digits) return [];
  const out = new Set();

  // NANP formatting helpers (assume country code 1)
  if (digits.length === 11 && digits.startsWith("1")) {
    const cc = digits.slice(0, 1);
    const a = digits.slice(1, 4);
    const b = digits.slice(4, 7);
    const c = digits.slice(7);
    out.add(`+${cc} ${a}-${b}-${c}`);
    out.add(`+${cc} (${a}) ${b}-${c}`);
    out.add(`+${digits}`);
    out.add(`${a}-${b}-${c}`);
    out.add(`(${a}) ${b}-${c}`);
    out.add(`${a}.${b}.${c}`);
    out.add(`${a} ${b} ${c}`);
    out.add(`${cc}${a}${b}${c}`); // 1XXXXXXXXXX
  } else if (digits.length === 10) {
    const a = digits.slice(0, 3);
    const b = digits.slice(3, 6);
    const c = digits.slice(6);
    out.add(`+1 ${a}-${b}-${c}`);
    out.add(`+1 (${a}) ${b}-${c}`);
    out.add(`+1${digits}`);
    out.add(`${a}-${b}-${c}`);
    out.add(`(${a}) ${b}-${c}`);
    out.add(`${a}.${b}.${c}`);
    out.add(`${a} ${b} ${c}`);
  } else {
    // Generic formats
    out.add(`+${digits}`);
    out.add(digits);
  }
  return Array.from(out).slice(0, 12);
}

function normalizePhone(input) {
  const cleaned = String(input || "").replace(/\D/g, "");
  let normalized = null;
  // Basic heuristics
  if (cleaned.length === 10)
    normalized = `+1${cleaned}`; // default to NANP if 10 digits
  else if (cleaned.length >= 11 && cleaned.length <= 15) {
    normalized = cleaned.startsWith("+") ? cleaned : `+${cleaned}`;
  }
  return { cleaned, normalized };
}

function inferRegion(digits) {
  if (!digits)
    return { country: "Unknown", code: null, timezone_estimate: null };
  if (digits.startsWith("1"))
    return {
      country: "US/Canada",
      code: "1",
      timezone_estimate: "America/New_York",
    };
  if (digits.startsWith("44"))
    return { country: "UK", code: "44", timezone_estimate: "Europe/London" };
  if (digits.startsWith("61"))
    return {
      country: "Australia",
      code: "61",
      timezone_estimate: "Australia/Sydney",
    };
  if (digits.startsWith("49"))
    return {
      country: "Germany",
      code: "49",
      timezone_estimate: "Europe/Berlin",
    };
  if (digits.startsWith("33"))
    return { country: "France", code: "33", timezone_estimate: "Europe/Paris" };
  if (digits.startsWith("34"))
    return { country: "Spain", code: "34", timezone_estimate: "Europe/Madrid" };
  if (digits.startsWith("39"))
    return { country: "Italy", code: "39", timezone_estimate: "Europe/Rome" };
  if (digits.startsWith("81"))
    return { country: "Japan", code: "81", timezone_estimate: "Asia/Tokyo" };
  if (digits.startsWith("82"))
    return {
      country: "South Korea",
      code: "82",
      timezone_estimate: "Asia/Seoul",
    };
  if (digits.startsWith("86"))
    return { country: "China", code: "86", timezone_estimate: "Asia/Shanghai" };
  if (digits.startsWith("91"))
    return { country: "India", code: "91", timezone_estimate: "Asia/Kolkata" };
  return { country: "Unknown", code: null, timezone_estimate: null };
}

function extractEmails(html) {
  if (!html) return [];
  const re = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
  const seen = new Set();
  const out = [];
  for (const m of html.match(re) || []) {
    const lower = m.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      out.push(lower);
    }
  }
  return out.slice(0, 50);
}

function extractTitle(html) {
  try {
    const m = html.match(/<title[^>]*>([^<]{1,200})<\/title>/i);
    if (m) return m[1].replace(/\s+/g, " ").trim();
  } catch {}
  return null;
}

function decodeDuckUrl(u) {
  try {
    // DuckDuckGo wraps results as /l/?kh=1&uddg=<encoded>
    const url = new URL(u, "https://duckduckgo.com");
    const uddg = url.searchParams.get("uddg");
    return uddg ? decodeURIComponent(uddg) : u;
  } catch {
    return u;
  }
}

async function searchDuckDuckGo(query, opts = {}) {
  const url = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const res = await safeFetch(url, {
    timeoutMs: opts.timeoutMs ?? 10000,
    retries: opts.retries ?? 2,
    headers: { "User-Agent": "Mozilla/5.0" },
  });
  if (!res.ok) return [];
  const html = await res.text();
  // crude link extraction for result anchors
  const links = [];
  const re = /<a[^>]+class=["']result__a["'][^>]+href=["']([^"']+)["'][^>]*>/g;
  let m;
  while ((m = re.exec(html))) {
    links.push(decodeDuckUrl(m[1]));
    if (links.length >= (opts.maxLinks ?? 12)) break;
  }
  return links;
}

export async function reversePhoneWebScan(input, opts = {}) {
  const { normalized } = normalizePhone(input);
  const digits = (normalized || "").replace(/\D/g, "");
  const variants = phoneDisplayVariants(normalized);
  const deep = !!opts.deepScan;

  const queries = new Set();
  // base queries with most discriminative forms first
  if (normalized) queries.add(`"${normalized}"`);
  for (const v of variants) queries.add(`"${v}"`);
  // try without quotes for broader matches
  if (digits) queries.add(digits);

  const results = [];
  const discoveredUrls = new Set();
  const emails = new Set();

  for (const q of Array.from(queries).slice(0, deep ? 6 : 4)) {
    try {
      const links = await searchDuckDuckGo(q, { maxLinks: deep ? 16 : 8 });
      for (const link of links) {
        if (discoveredUrls.has(link)) continue;
        discoveredUrls.add(link);
        try {
          const r = await safeFetch(link, {
            timeoutMs: deep ? 12000 : 8000,
            retries: deep ? 3 : 2,
            headers: { "User-Agent": "Mozilla/5.0" },
          });
          if (!r.ok) continue;
          const html = await r.text();
          const title = extractTitle(html);
          const foundEmails = extractEmails(html);
          foundEmails.forEach((e) => emails.add(e));

          // Create a small snippet around the number, if present
          let snippet = null;
          try {
            const idx = html.indexOf(digits);
            if (idx !== -1) {
              const start = Math.max(0, idx - 120);
              const end = Math.min(html.length, idx + 120);
              snippet = html
                .slice(start, end)
                .replace(/<[^>]+>/g, " ")
                .replace(/\s+/g, " ")
                .trim();
            }
          } catch {}

          results.push({ url: link, title, snippet });
          if (results.length >= (deep ? 30 : 15)) break;
        } catch {}
      }
      if (results.length >= (deep ? 30 : 15)) break;
    } catch {}
  }

  return {
    query_variants: Array.from(queries),
    items: results,
    emails: Array.from(emails),
    discovered_urls: Array.from(discoveredUrls),
  };
}

export async function phoneIntel(input) {
  const cleaned = String(input).replace(/\D/g, "");
  const out = { original: input, cleaned };
  const { normalized } = normalizePhone(input);
  out.normalized = normalized;

  out.length = cleaned.length;
  out.format_valid = cleaned.length >= 10 && cleaned.length <= 15;

  const digits = (normalized || "").replace(/\D/g, "");
  out.region = inferRegion(digits);

  // Line type heuristic (very crude; NANP style check)
  out.line_type = cleaned.match(/^[2-9][0-9]{2}[2-9][0-9]{6}$/)
    ? "landline_or_mobile"
    : "unknown";

  // Attach display variants to help the UI and downstream collectors
  out.display_variants = phoneDisplayVariants(normalized);

  return out;
}
