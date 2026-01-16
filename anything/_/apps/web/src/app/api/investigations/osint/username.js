import { safeFetch } from "./helpers.js";

export async function usernameIntel(username, opts = {}) {
  const startedAt = Date.now();
  const deep = !!opts.deepScan;

  const timeBudgetMs =
    typeof opts.timeBudgetMs === "number" && Number.isFinite(opts.timeBudgetMs)
      ? Math.max(1000, opts.timeBudgetMs)
      : deep
        ? 35_000
        : 18_000;

  const deadline = () => Date.now() - startedAt > timeBudgetMs;

  const candidates = new Set([String(username || "").trim()].filter(Boolean));
  (opts.extraCandidates || []).forEach((u) => {
    const v = String(u || "").trim();
    if (v) candidates.add(v);
  });

  // Keep permutations bounded. The old implementation generated a large set
  // then attempted thousands of sequential fetches, which caused investigations
  // to stall and client-side tick requests to abort.
  const perms = generateUsernamePermutations(username);
  perms.slice(0, deep ? 35 : 15).forEach((u) => candidates.add(u));

  const includeNSFW =
    opts.includeNSFW !== undefined ? !!opts.includeNSFW : true;

  const basePlatforms = [
    // (Keep the list, but we will cap checks and run concurrently)
    {
      name: "GitHub",
      url: (u) => `https://github.com/${u}`,
      notFound: "Not Found",
      category: "tech",
    },
    {
      name: "Reddit",
      url: (u) => `https://www.reddit.com/user/${u}`,
      notFound: "page not found",
      category: "social",
    },
    {
      name: "Twitter",
      url: (u) => `https://x.com/${u}`,
      notFound: "This account doesn't exist",
      category: "social",
    },
    {
      name: "Instagram",
      url: (u) => `https://www.instagram.com/${u}/`,
      notFound: "Page Not Found",
      category: "social",
    },
    {
      name: "TikTok",
      url: (u) => `https://www.tiktok.com/@${u}`,
      notFound: "404",
      category: "social",
    },
    {
      name: "YouTube",
      url: (u) => `https://www.youtube.com/@${u}`,
      notFound: "404",
      category: "social",
    },
    {
      name: "GitLab",
      url: (u) => `https://gitlab.com/${u}`,
      notFound: "Users",
      category: "tech",
    },
    {
      name: "StackOverflow",
      url: (u) => `https://stackoverflow.com/users/${u}`,
      notFound: "Page Not Found",
      category: "tech",
    },
    {
      name: "Steam",
      url: (u) => `https://steamcommunity.com/id/${u}`,
      notFound: "The specified profile could not be found",
      category: "gaming",
    },
    {
      name: "Pinterest",
      url: (u) => `https://www.pinterest.com/${u}/`,
      notFound: "404",
      category: "social",
    },
  ];

  const nsfwPlatforms = [
    {
      name: "OnlyFans",
      url: (u) => `https://onlyfans.com/${u}`,
      notFound: "Sign up to see",
      category: "adult",
    },
    {
      name: "Fansly",
      url: (u) => `https://fansly.com/${u}`,
      notFound: "404",
      category: "adult",
    },
    {
      name: "Pornhub",
      url: (u) => `https://www.pornhub.com/users/${u}`,
      notFound: "Page not found",
      category: "adult",
    },
    {
      name: "XHamster",
      url: (u) => `https://xhamster.com/users/${u}`,
      notFound: "404",
      category: "adult",
    },
    {
      name: "FetLife",
      url: (u) => `https://fetlife.com/${u}`,
      notFound: "404",
      category: "fetish",
    },
  ];

  const platforms = includeNSFW
    ? [...basePlatforms, ...nsfwPlatforms]
    : basePlatforms;

  const crossRefs = normalizeCrossRefs(opts.crossRefs || {});

  // Hard caps to keep requests bounded.
  const candidateList = Array.from(candidates).slice(0, deep ? 20 : 10);
  const platformList = platforms.slice(0, deep ? 18 : 12);

  const combos = [];
  for (const u of candidateList) {
    for (const p of platformList) {
      combos.push({ u, p, url: p.url(u) });
    }
  }

  const MAX_CHECKS = deep ? 160 : 60;
  const checks = combos.slice(0, MAX_CHECKS);

  const CONCURRENCY = deep ? 10 : 8;
  const profiles = [];

  let idx = 0;
  const worker = async () => {
    while (idx < checks.length && !deadline()) {
      const item = checks[idx];
      idx += 1;

      const { u, p, url } = item;
      try {
        const res = await safeFetch(url, {
          timeoutMs: deep ? 5500 : 4000,
          retries: 0,
        });
        let exists = false;
        let extra = {};
        let html = "";

        try {
          html = res.ok ? await res.text() : "";

          const statusOk = res.ok;
          const finalUrl = res.url || url;
          const redirectedToLogin =
            finalUrl.includes("/login") ||
            finalUrl.includes("signin") ||
            (finalUrl !== url && finalUrl === "https://www.instagram.com/");

          const lenOk = html && html.length > 80;
          const blocked =
            /attention required|captcha|access denied|forbidden/i.test(
              html || "",
            );

          exists =
            statusOk &&
            lenOk &&
            !redirectedToLogin &&
            !(
              p.notFound &&
              html &&
              html.toLowerCase().includes(p.notFound.toLowerCase())
            ) &&
            !blocked;

          if (exists && p.name === "GitHub") {
            const m = html.match(
              /<meta\s+name="octolytics-dimension-user_login"\s+content="([^"]+)"/i,
            );
            extra = { username: m?.[1] || u };
          }

          if (exists && p.name === "Reddit") {
            const display = (html.match(/<title>([^<]+) - Reddit<\/title>/i) ||
              [])[1];
            extra = { ...extra, display_name: display };
          }
        } catch {
          // ignore per-site parse failures
        }

        const evidence = findCrossRefEvidence(html, crossRefs);
        const hasAnyEvidence = Object.values(evidence).some(
          (arr) => (arr || []).length > 0,
        );

        const isOriginal =
          u.toLowerCase() === String(username || "").toLowerCase();
        const isWeakPermutation =
          !isOriginal &&
          (/[0-9]/.test(u) ||
            /^(the|real|official|iam)/i.test(u) ||
            /(official|real|pro|dev|app)$/i.test(u));

        if (exists && !isOriginal && isWeakPermutation && !hasAnyEvidence) {
          exists = false;
        }

        const baseConf = exists ? (isOriginal ? 0.6 : 0.3) : 0.1;
        const confBoost =
          (evidence.phones?.length ? 0.3 : 0) +
          (evidence.emails?.length ? 0.2 : 0) +
          (evidence.usernames?.length ? 0.15 : 0) +
          (evidence.domains?.length ? 0.15 : 0);

        const confidence = Math.min(1, baseConf + confBoost);
        const isNSFWSite = p.category === "adult" || p.category === "fetish";

        profiles.push({
          platform: p.name,
          platform_category: p.category,
          profile_url: url,
          exists,
          username: u,
          meta: extra,
          confidence,
          risk_hints: { nsfw_site: isNSFWSite },
          match_evidence: hasAnyEvidence ? evidence : undefined,
        });
      } catch {
        // ignore per-request errors
      }
    }
  };

  await Promise.allSettled(
    Array.from({
      length: Math.min(CONCURRENCY, Math.max(1, checks.length)),
    }).map(() => worker()),
  );

  // Enrich only the strongest results.
  const ENRICH_LIMIT = deep ? 30 : 14;
  const toEnrich = profiles
    .filter((p) => p.exists || p.match_evidence)
    .sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
    .slice(0, ENRICH_LIMIT);

  const enriched = await enrichSocialProfiles(toEnrich);
  const enrichedByUrl = new Map(enriched.map((e) => [e.profile_url, e]));
  const merged = profiles.map((p) => enrichedByUrl.get(p.profile_url) || p);
  merged.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));

  return {
    query: username,
    candidates: Array.from(candidates),
    profiles: merged.slice(0, deep ? 150 : 80),
    meta: {
      deep,
      time_budget_ms: timeBudgetMs,
      elapsed_ms: Date.now() - startedAt,
      checks_attempted: checks.length,
      checks_completed: profiles.length,
    },
  };
}

export function generateUsernamePermutations(u) {
  const list = new Set();
  const leet = (s) =>
    s
      .replace(/a/gi, "4")
      .replace(/e/gi, "3")
      .replace(/i/gi, "1")
      .replace(/o/gi, "0")
      .replace(/s/gi, "5");
  const base = u;
  list.add(base);
  list.add(leet(base));
  list.add(`${base}_`);
  list.add(`_${base}`);
  list.add(`${base}-`);
  list.add(`${base}.`);
  list.add(`${base}123`);
  list.add(`${base}01`);
  list.add(`${base}2024`);
  list.add(`${base}2025`);
  list.add(`the${base}`);
  list.add(`${base}the`);
  list.add(`${base}_official`);
  list.add(`${base}-official`);
  list.add(`${base}_real`);
  list.add(`${base}-real`);
  list.add(`real${base}`);
  list.add(`${base}pro`);
  list.add(`${base}_dev`);
  list.add(`${base}app`);
  return Array.from(list);
}

// NEW: normalize cross-ref inputs
function normalizeCrossRefs(refs) {
  const toArray = (v) => (Array.isArray(v) ? v : v ? [v] : []);
  const phones = toArray(refs.phones).map((p) => String(p));
  const emails = toArray(refs.emails).map((e) =>
    String(e).toLowerCase().trim(),
  );
  const usernames = toArray(refs.usernames).map((u) => String(u));
  const domains = toArray(refs.domains).map((d) => String(d).toLowerCase());
  return { phones, emails, usernames, domains };
}

// NEW: find phones/emails/usernames/domains in HTML body
function findCrossRefEvidence(html, refs) {
  const out = { phones: [], emails: [], usernames: [], domains: [] };
  if (!html) return out;
  try {
    const body = html.toLowerCase();
    // Phones: search common digit-only and pretty formats
    for (const p of refs.phones || []) {
      const digits = p.replace(/\D/g, "");
      if (!digits || digits.length < 7) continue;
      const variants = new Set(
        [
          digits,
          `+${digits}`,
          // US pretty formats (best-effort)
          digits.length === 11 && digits.startsWith("1")
            ? `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`
            : null,
          digits.length === 10
            ? `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
            : null,
          digits.length === 11 && digits.startsWith("1")
            ? `${digits.slice(1, 4)}-${digits.slice(4, 7)}-${digits.slice(7)}`
            : null,
          // spaced international like +1 234 567 8901
          digits.length >= 10
            ? `+${digits[0]} ${digits.slice(1, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`
            : null,
        ].filter(Boolean),
      );
      for (const v of variants) {
        if (body.includes(v.toLowerCase())) out.phones.push(p);
      }
    }
    for (const e of refs.emails || []) {
      if (body.includes(e)) out.emails.push(e);
    }
    for (const u of refs.usernames || []) {
      if (body.includes(u.toLowerCase())) out.usernames.push(u);
    }
    for (const d of refs.domains || []) {
      if (body.includes(d)) out.domains.push(d);
    }
  } catch {}
  return out;
}

export async function enrichSocialProfiles(found) {
  const enriched = [];
  for (const p of found) {
    const add = { ...p };
    try {
      const res = await safeFetch(p.profile_url);
      const html = res.ok ? await res.text() : "";
      // very light enrichment
      if (p.platform === "Twitter") {
        const bio = (html.match(/<meta name="description" content="([^"]+)"/) ||
          [])[1];
        add.meta = { ...(add.meta || {}), bio };
      }
      // risk hints
      const bioText = (add.meta?.bio || "").toLowerCase();
      const nsfw =
        /(nsfw|adult|xxx)/.test(bioText) || p.risk_hints?.nsfw_site === true;
      add.risk_hints = { ...(add.risk_hints || {}), nsfw_bio: nsfw };
    } catch {}
    enriched.push(add);
  }
  return enriched;
}
