import { safeFetch } from "./helpers.js";

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
  return out.slice(0, 200);
}

function extractPhones(html) {
  if (!html) return [];
  const candidates = new Set();
  // crude: match 10-15 digit groups and common formats
  const re = /(\+?\d[\d\s().-]{7,})/g;
  let m;
  while ((m = re.exec(html))) {
    const digits = m[1].replace(/\D/g, "");
    if (digits.length >= 10 && digits.length <= 15) candidates.add(digits);
  }
  return Array.from(candidates).slice(0, 200);
}

function extractLinks(html, baseUrl) {
  const out = new Set();
  try {
    const re = /<a[^>]+href=["']([^"']+)["']/gi;
    let m;
    while ((m = re.exec(html))) {
      let u = m[1];
      try {
        const abs = new URL(u, baseUrl).toString();
        out.add(abs);
      } catch {}
    }
  } catch {}
  return Array.from(out).slice(0, 500);
}

export async function deepWebDiscovery(seedUrls = [], opts = {}) {
  const deep = !!opts.deepScan;

  // Tighten defaults so OSINT doesn't appear to “hang” for minutes.
  // Can be overridden by callers.
  const MAX_PAGES =
    typeof opts.maxPages === "number" && Number.isFinite(opts.maxPages)
      ? Math.max(0, opts.maxPages)
      : deep
        ? 25
        : 10;

  const MAX_TIME_MS =
    typeof opts.maxTimeMs === "number" && Number.isFinite(opts.maxTimeMs)
      ? Math.max(0, opts.maxTimeMs)
      : deep
        ? 90_000
        : 35_000;

  const CONCURRENCY =
    typeof opts.concurrency === "number" && Number.isFinite(opts.concurrency)
      ? Math.max(1, Math.floor(opts.concurrency))
      : deep
        ? 4
        : 3;

  const startedAt = Date.now();
  const results = [];

  const queue = Array.from(new Set(seedUrls)).slice(0, MAX_PAGES);
  let idx = 0;

  const shouldContinue = () => Date.now() - startedAt < MAX_TIME_MS;

  const worker = async () => {
    while (idx < queue.length && shouldContinue()) {
      const url = queue[idx];
      idx += 1;

      try {
        const res = await safeFetch(url, {
          timeoutMs: deep ? 12_000 : 8_000,
          retries: deep ? 2 : 1,
          headers: { "User-Agent": "Mozilla/5.0" },
        });
        if (!res.ok) continue;
        const html = await res.text();

        const emails = extractEmails(html);
        const phones = extractPhones(html);
        const links = extractLinks(html, url);
        results.push({ url, emails, phones, links });

        if (results.length >= MAX_PAGES) break;
      } catch {
        // non-fatal
      }
    }
  };

  await Promise.allSettled(
    Array.from({
      length: Math.min(CONCURRENCY, Math.max(1, queue.length)),
    }).map(() => worker()),
  );

  // Aggregate unique emails/phones/links
  const uniqEmails = new Set();
  const uniqPhones = new Set();
  const uniqLinks = new Set();
  for (const r of results) {
    (r.emails || []).forEach((e) => uniqEmails.add(e));
    (r.phones || []).forEach((p) => uniqPhones.add(p));
    (r.links || []).forEach((l) => uniqLinks.add(l));
  }

  return {
    pages: results,
    aggregate: {
      emails: Array.from(uniqEmails).slice(0, deep ? 500 : 150),
      phones: Array.from(uniqPhones).slice(0, deep ? 500 : 150),
      links: Array.from(uniqLinks).slice(0, deep ? 800 : 250),
    },
    meta: {
      deep,
      max_pages: MAX_PAGES,
      max_time_ms: MAX_TIME_MS,
      elapsed_ms: Date.now() - startedAt,
      attempted: queue.length,
      collected: results.length,
    },
  };
}
