import { safeFetch } from "./helpers.js";

// Simple in-memory cache with TTL for fetched pages
const __CACHE__ = new Map(); // key: url, value: { ts: number, html: string }
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function setCache(url, html) {
  try {
    __CACHE__.set(url, { ts: Date.now(), html });
  } catch {}
}
function getCache(url) {
  try {
    const v = __CACHE__.get(url);
    if (v && Date.now() - v.ts < CACHE_TTL_MS) return v.html;
    if (v) __CACHE__.delete(url);
  } catch {}
  return null;
}

// Lightweight rate limit: small delay between requests
const RATE_DELAY_MS = 250; // 4 req/sec per instance
function delay(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

// Tighter timeout wrapper for scraping-heavy calls (now uses safeFetch timeoutMs)
async function fetchWithTighterTimeout(url, opts = {}) {
  return safeFetch(url, { ...opts, timeoutMs: opts.timeoutMs ?? 8000 }); // default 8s timeout
}

// Simple phone extractor from HTML/text
function extractPhonesFromHtml(html) {
  if (!html) return [];
  const body = html.replace(/\s+/g, " ");
  // Matches common phone formats: +1 555-555-5555, (555) 555 5555, 555.555.5555, 15555555555, etc.
  const re =
    /(?:(?:\+?\d{1,3}[\s.-]?)?(?:\(\d{2,4}\)|\d{2,4})[\s.-]?\d{2,4}[\s.-]?\d{3,4}(?:[\s.-]?\d{2,4})?)/g;
  const matches = body.match(re) || [];
  const cleaned = matches
    .map((m) => m.trim())
    // Filter out obvious false positives (short, long, or pure date-like)
    .filter(
      (m) =>
        m.replace(/\D/g, "").length >= 10 && m.replace(/\D/g, "").length <= 15,
    )
    .slice(0, 20);
  // De-dupe by digits-only normalization
  const seen = new Set();
  const out = [];
  for (const m of cleaned) {
    const digits = m.replace(/\D/g, "");
    if (!seen.has(digits)) {
      seen.add(digits);
      out.push({ display: m, digits });
    }
  }
  return out;
}

// NEW: Simple email extractor
function extractEmailsFromHtml(html) {
  if (!html) return [];
  const body = html.replace(/\s+/g, " ");
  // Basic email regex (lowercased later)
  const re = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
  const matches = body.match(re) || [];
  const seen = new Set();
  const out = [];
  for (const m of matches.slice(0, 50)) {
    const lower = m.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      out.push({ email: lower, display: m });
    }
  }
  return out;
}

// NEW: Extract href links quickly
function extractHrefsFromHtml(html) {
  if (!html) return [];
  const out = [];
  const hrefRe = /href\s*=\s*(["'])((?:https?:)?\/\/[^"'\s]+)\1/gi;
  let m;
  while ((m = hrefRe.exec(html))) {
    out.push(m[2]);
  }
  return out;
}

// Try a few public profile hubs and site pages that often list contact numbers
export async function phoneDirectoriesSeed(
  { email, username, domain },
  opts = {},
) {
  const seedPhones = [];
  const urls = new Set();

  const deep = !!opts.deepScan;

  // Profile hubs by username
  const u = (username || (email ? String(email).split("@")[0] : "")).trim();
  if (u) {
    urls.add(`https://linktr.ee/${encodeURIComponent(u)}`);
    urls.add(`https://beacons.ai/${encodeURIComponent(u)}`);
    urls.add(`https://bio.link/${encodeURIComponent(u)}`);
    urls.add(`https://about.me/${encodeURIComponent(u)}`);
    // NEW hubs
    urls.add(`https://solo.to/${encodeURIComponent(u)}`);
    urls.add(`https://campsite.bio/${encodeURIComponent(u)}`);
    urls.add(`https://tap.bio/@${encodeURIComponent(u)}`);
    urls.add(`https://taplink.cc/${encodeURIComponent(u)}`);
    urls.add(`https://flow.page/${encodeURIComponent(u)}`);
    urls.add(`https://withkoji.com/@${encodeURIComponent(u)}`);
    urls.add(`https://koji.to/@${encodeURIComponent(u)}`);
    urls.add(`https://stan.store/${encodeURIComponent(u)}`);
    // NEWER hubs requested
    urls.add(`https://linkstack.bio/${encodeURIComponent(u)}`);
    urls.add(`https://bio.site/${encodeURIComponent(u)}`);
    urls.add(`https://linkin.bio/${encodeURIComponent(u)}`);
  }

  // Domain contact pages
  const d = (domain || (email ? String(email).split("@")[1] : "")).trim();
  if (d) {
    const base = d.startsWith("http") ? d : `https://${d}`;
    [
      "/",
      "/contact",
      "/contact-us",
      "/about",
      "/support",
      "/help",
      // NEW: more common pages
      "/about-us",
      "/company",
      "/team",
      "/legal",
      "/privacy",
      "/terms",
      "/press",
    ].forEach((p) => urls.add(`${base.replace(/\/$/, "")}${p}`));
  }

  // Best-effort fetch and parse (cached + rate-limited)
  for (const url of Array.from(urls).slice(0, deep ? 50 : 30)) {
    // was 20 -> 30, 50 on deep
    try {
      const cached = getCache(url);
      let html;
      if (cached) {
        html = cached;
      } else {
        const res = await fetchWithTighterTimeout(url, {
          headers: { "User-Agent": "Mozilla/5.0" },
          timeoutMs: deep ? 12000 : 8000,
          retries: deep ? 3 : 2,
        });
        if (!res.ok) {
          await delay(RATE_DELAY_MS);
          continue;
        }
        html = await res.text();
        setCache(url, html);
        await delay(RATE_DELAY_MS);
      }
      const found = extractPhonesFromHtml(html);
      for (const f of found) {
        seedPhones.push({
          source_url: url,
          digits: f.digits,
          display: f.display,
        });
      }
      if (seedPhones.length >= (deep ? 50 : 25)) break; // keep it light-ish
    } catch {
      await delay(RATE_DELAY_MS);
    }
  }

  // De-dupe by digits
  const uniq = [];
  const seen = new Set();
  for (const p of seedPhones) {
    if (!seen.has(p.digits)) {
      seen.add(p.digits);
      uniq.push(p);
    }
  }

  return { seedPhones: uniq };
}

// NEW: Broader discovery pass to add more hubs (solo.to, canva/carrd bios) and simple business pages via on-site links
export async function hubDiscoverySeed({ email, username, domain }, opts = {}) {
  const seedPhones = [];
  const seedEmails = [];
  const discovered = new Set();
  const candidates = new Set();

  const deep = !!opts.deepScan;

  const u = (username || (email ? String(email).split("@")[0] : "")).trim();
  const d = (domain || (email ? String(email).split("@")[1] : "")).trim();

  const add = (url) => {
    if (!url) return;
    try {
      const normalized = url.replace(/^(?!(?:https?:)?\/\/)/, "https://");
      candidates.add(normalized);
    } catch {}
  };

  // Username-based hubs
  if (u) {
    [
      `https://solo.to/${encodeURIComponent(u)}`,
      `https://campsite.bio/${encodeURIComponent(u)}`,
      `https://tap.bio/@${encodeURIComponent(u)}`,
      `https://taplink.cc/${encodeURIComponent(u)}`,
      `https://flow.page/${encodeURIComponent(u)}`,
      `https://withkoji.com/@${encodeURIComponent(u)}`,
      `https://koji.to/@${encodeURIComponent(u)}`,
      `https://stan.store/${encodeURIComponent(u)}`,
      // Subdomain-style bios
      `https://${encodeURIComponent(u)}.carrd.co`,
      `https://${encodeURIComponent(u)}.my.canva.site`,
      `https://${encodeURIComponent(u)}.canva.site`,
      // NEWER hubs requested
      `https://linkstack.bio/${encodeURIComponent(u)}`,
      `https://bio.site/${encodeURIComponent(u)}`,
      `https://linkin.bio/${encodeURIComponent(u)}`,
    ].forEach(add);
  }

  // Domain pages and on-page links to hubs
  if (d) {
    const base = d.startsWith("http") ? d : `https://${d}`;
    const baseClean = base.replace(/\/$/, "");
    const domainPages = [
      "/",
      "/contact",
      "/contact-us",
      "/about",
      "/support",
      "/help",
      "/about-us",
      "/company",
      "/team",
      "/legal",
      "/privacy",
      "/terms",
      "/press",
    ];

    // Fetch homepage first to look for outbound hub links
    try {
      const cached = getCache(`${baseClean}/`);
      let html;
      if (cached) {
        html = cached;
      } else {
        const res = await fetchWithTighterTimeout(`${baseClean}/`, {
          headers: { "User-Agent": "Mozilla/5.0" },
          timeoutMs: deep ? 12000 : 8000,
          retries: deep ? 3 : 2,
        });
        if (res.ok) {
          html = await res.text();
          setCache(`${baseClean}/`, html);
        }
        await delay(RATE_DELAY_MS);
      }
      if (html) {
        const hrefs = extractHrefsFromHtml(html);
        const hubHints = [
          "linktr.ee/",
          "beacons.ai/",
          "bio.link/",
          "about.me/",
          "solo.to/",
          "campsite.bio/",
          "tap.bio/",
          "taplink.cc/",
          "flow.page/",
          "withkoji.com/",
          "koji.to/",
          "stan.store/",
          ".carrd.co",
          ".my.canva.site",
          ".canva.site",
          // light touch business directories often linked from footers or profiles
          "yelp.com/biz/",
          "manta.com/",
          "yellowpages.com/",
          "bbb.org/",
          // NEW hubs requested
          "linkstack.bio/",
          "bio.site/",
          "linkin.bio/",
        ];
        for (const h of hrefs) {
          if (hubHints.some((hint) => h.includes(hint))) {
            add(h);
          }
        }
      }
    } catch {
      // ignore
    }

    // Also scan a few standard pages directly
    domainPages.forEach((p) => add(`${baseClean}${p}`));
  }

  // Fetch and extract from candidates (phones + emails) with cache/rate-limit
  for (const url of Array.from(candidates).slice(0, deep ? 120 : 60)) {
    // was 40 -> 60, 120 on deep
    try {
      const cached = getCache(url);
      let html;
      if (cached) {
        html = cached;
      } else {
        const res = await fetchWithTighterTimeout(url, {
          headers: { "User-Agent": "Mozilla/5.0" },
          timeoutMs: deep ? 12000 : 8000,
          retries: deep ? 3 : 2,
        });
        if (!res.ok) {
          await delay(RATE_DELAY_MS);
          continue;
        }
        html = await res.text();
        setCache(url, html);
        await delay(RATE_DELAY_MS);
      }

      const phones = extractPhonesFromHtml(html);
      const emails = extractEmailsFromHtml(html);

      phones.forEach((p) =>
        seedPhones.push({
          source_url: url,
          digits: p.digits,
          display: p.display,
        }),
      );
      emails.forEach((e) =>
        seedEmails.push({
          source_url: url,
          email: e.email,
          display: e.display,
        }),
      );

      discovered.add(url);

      if (
        seedPhones.length >= (deep ? 50 : 25) &&
        seedEmails.length >= (deep ? 50 : 25)
      )
        break;
    } catch {
      await delay(RATE_DELAY_MS);
    }
  }

  // De-dupe
  const phoneSeen = new Set();
  const emailSeen = new Set();
  const uniqPhones = [];
  const uniqEmails = [];

  for (const p of seedPhones) {
    if (!phoneSeen.has(p.digits)) {
      phoneSeen.add(p.digits);
      uniqPhones.push(p);
    }
  }
  for (const e of seedEmails) {
    if (!emailSeen.has(e.email)) {
      emailSeen.add(e.email);
      uniqEmails.push(e);
    }
  }

  return {
    seedPhones: uniqPhones,
    seedEmails: uniqEmails,
    discoveredUrls: Array.from(discovered),
  };
}
