import { safeFetch, searchDuckDuckGo } from "./helpers.js";

// Property records via Estated API if available
async function fetchEstated(address) {
  const token = process.env.ESTATED_API_KEY || process.env.ESTATED_TOKEN;
  if (!token) return { items: [], error: "Missing ESTATED_API_KEY" };
  const url = `https://api.estated.com/v4/property?token=${encodeURIComponent(
    token,
  )}&combined_address=${encodeURIComponent(address)}`;
  try {
    const res = await safeFetch(url, { timeoutMs: 12000 });
    if (!res.ok) {
      return { items: [], error: `Estated response ${res.status}` };
    }
    const json = await res.json();
    const p = json?.data || {};
    const deed = {
      address:
        p?.mailing_address?.formatted || p?.address?.formatted || address,
      owner: p?.owner?.name || null,
      owner2: p?.owner?.second_name || null,
      last_sale_price: p?.sales?.[0]?.amount || null,
      last_sale_date: p?.sales?.[0]?.date || null,
      buyer: p?.sales?.[0]?.buyer || null,
      seller: p?.sales?.[0]?.seller || null,
      assessed_value: p?.assessment?.assessed_total || null,
      parcel_number: p?.apn || null,
      bedrooms: p?.structure?.bedrooms || null,
      bathrooms: p?.structure?.bathrooms || null,
      lot_size: p?.lot?.lot_size || null,
      year_built: p?.structure?.year_built || null,
      source: {
        name: "Estated",
        url,
      },
    };
    return { items: [deed] };
  } catch (e) {
    return { items: [], error: e.message };
  }
}

export async function propertyRecordsByAddress(address) {
  // Try Estated first; can later add ATTOM/DataTree if keys present
  const estated = await fetchEstated(address);
  const items = estated.items || [];
  const errors = [estated.error].filter(Boolean);

  // Fallback: Web search for property records if API fails or returns nothing
  if (items.length === 0) {
    try {
      const links = await searchDuckDuckGo(`property records "${address}"`, {
        maxLinks: 5,
      });
      items.push(
        ...links.map((url) => ({
          address,
          source: { name: "Web Search", url },
          note: "Requires manual verification",
        })),
      );
    } catch (e) {
      errors.push(`Web search failed: ${e.message}`);
    }
  }

  return { items, errors };
}

// CourtListener / Free Law Project (CourtListener) — dockets search
const COURTLISTENER_BASE = "https://www.courtlistener.com/api/rest/v3";

function toISODateOnly(value) {
  if (!value) return null;
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 10);
  } catch {
    return null;
  }
}

function computeCaseRoleFromCaption(caption, subject) {
  if (!caption || !subject) return null;
  const c = String(caption).toLowerCase();
  const s = String(subject).toLowerCase();

  // Try to infer from caption position: "A v. B" — if subject matches B, likely defendant.
  const parts = c.split(/\sv\.?\s|\svs\.?\s|\sversus\s/i);
  if (parts.length >= 2) {
    const left = parts[0] || "";
    const right = parts.slice(1).join(" ") || "";
    if (right.includes(s)) return "Defendant";
    if (left.includes(s)) return "Plaintiff";
  }

  return null;
}

function computeLegalRiskForCase(caseObj, subject) {
  const text =
    `${caseObj?.case_name || ""} ${caseObj?.nature_of_suit || ""}`.toLowerCase();

  let score = 0;

  if (/fraud|scam|racketeer|rico|embezzl|theft|money\s+launder/.test(text))
    score += 3;
  if (
    /contract|breach|debt|collection|foreclos|evict|landlord|tenant/.test(text)
  )
    score += 1;
  if (/injury|malpractice|negligence|wrongful\s+death/.test(text)) score += 1;

  const court = (caseObj?.court || "").toLowerCase();
  if (/district\s+court|circuit|scotus|supreme\s+court|federal/.test(court))
    score += 1;

  const filed = caseObj?.date_filed ? new Date(caseObj.date_filed) : null;
  if (filed && !Number.isNaN(filed.getTime())) {
    const years =
      (Date.now() - filed.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
    if (years <= 5) score += 1;
  }

  const role =
    caseObj?.role || computeCaseRoleFromCaption(caseObj?.case_name, subject);
  if (role === "Defendant") score += 1;

  let risk_level = "Low";
  if (score >= 5) risk_level = "High";
  else if (score >= 2) risk_level = "Medium";

  return { score, risk_level, role: role || null };
}

async function fetchCourtListenerDocketsSearch(query) {
  const q = String(query || "").trim();
  if (!q) return { items: [], error: "Missing query" };

  // NOTE: CourtListener uses type=d for docket search (federal dockets).
  const url = `${COURTLISTENER_BASE}/search/?type=d&q=${encodeURIComponent(q)}`;

  try {
    const res = await safeFetch(url, {
      timeoutMs: 15000,
      retries: 2,
      headers: {
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      return { items: [], error: `CourtListener response ${res.status}` };
    }

    const json = await res.json();
    const results = Array.isArray(json?.results) ? json.results : [];

    const items = results.slice(0, 8).map((r) => {
      const docketId = r?.docket_id ?? r?.docketId ?? null;
      const docketNumber = r?.docketNumber ?? r?.docket_number ?? null;
      const caseName = r?.caseName ?? r?.case_name ?? null;
      const court = r?.court ?? r?.court_citation_string ?? null;
      const dateFiled = toISODateOnly(r?.dateFiled ?? r?.date_filed);
      const judges = r?.judge ?? r?.judges ?? null;
      const nature = r?.suitNature ?? r?.nature_of_suit ?? null;

      const abs = r?.absolute_url || r?.docket_absolute_url || null;
      const docket_url = abs
        ? `https://www.courtlistener.com${abs}`
        : docketId
          ? `https://www.courtlistener.com/docket/${docketId}/`
          : null;

      return {
        type: "freelawproject",
        source: "FreeLawProject (CourtListener)",
        docket_id: docketId,
        docket_number: docketNumber,
        case_name: caseName,
        court,
        date_filed: dateFiled,
        judges,
        nature_of_suit: nature,
        parties: null,
        url: docket_url,
      };
    });

    return { items };
  } catch (e) {
    return { items: [], error: e?.message || "CourtListener request failed" };
  }
}

async function expandCourtListenerDocket(docketId) {
  if (!docketId) return null;

  const url = `${COURTLISTENER_BASE}/dockets/${encodeURIComponent(docketId)}/`;
  try {
    const res = await safeFetch(url, {
      timeoutMs: 15000,
      retries: 1,
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;

    const d = await res.json();

    // Keep this conservative: field names vary a bit by endpoint/version.
    return {
      docket_number: d?.docket_number ?? null,
      case_name: d?.case_name ?? d?.caseName ?? null,
      court: d?.court?.full_name ?? d?.court ?? null,
      date_filed: toISODateOnly(d?.date_filed ?? d?.dateFiled),
      judges:
        d?.assigned_to_str ??
        d?.assigned_to?.name ??
        d?.panel_str ??
        d?.judge ??
        null,
      nature_of_suit: d?.nature_of_suit ?? d?.suit_nature ?? null,
      parties: d?.parties ?? null,
      recap_available: d?.pacer_case_id ? true : null,
      url: d?.absolute_url
        ? `https://www.courtlistener.com${d.absolute_url}`
        : `https://www.courtlistener.com/docket/${docketId}/`,
    };
  } catch {
    return null;
  }
}

// NEW: Trellis (site search fallback)
async function fetchTrellisSiteResults(query) {
  try {
    const links = await searchDuckDuckGo(`site:trellis.law ${query}`, {
      maxLinks: 8,
    });

    const items = (links || []).map((url) => ({
      type: "trellis",
      case_name: `Trellis search result for ${query}`,
      court: "Trellis.law",
      date_filed: null,
      docket_number: null,
      url,
      source: "Trellis (site search)",
      note: "Requires manual verification",
    }));

    return { items };
  } catch (e) {
    return { items: [], error: e.message };
  }
}

export async function courtFilingsByName(nameOrQuery) {
  if (!nameOrQuery || String(nameOrQuery).trim().length < 3) {
    return { items: [], errors: ["Query too short"] };
  }

  const q = String(nameOrQuery).trim();

  // Trellis-first discovery (no direct fetch to trellis.law, which is commonly blocked)
  const trellis = await fetchTrellisSiteResults(q);

  // NEW: Free Law Project / CourtListener structured docket search
  const cl = await fetchCourtListenerDocketsSearch(q);

  // Optional: expand a couple of dockets for better fields (parties, judges, nature_of_suit)
  const expandedItems = [];
  try {
    const docketIds = (cl.items || [])
      .map((x) => x?.docket_id)
      .filter(Boolean)
      .slice(0, 3);

    for (const docketId of docketIds) {
      const detail = await expandCourtListenerDocket(docketId);
      if (!detail) continue;
      expandedItems.push({
        type: "freelawproject",
        source: "FreeLawProject (CourtListener)",
        docket_id: docketId,
        docket_number: detail.docket_number,
        case_name: detail.case_name,
        court: detail.court,
        date_filed: detail.date_filed,
        judges: detail.judges,
        nature_of_suit: detail.nature_of_suit,
        parties: detail.parties,
        url: detail.url,
        recap_available: detail.recap_available,
      });
    }
  } catch {
    // non-fatal
  }

  // Merge: prefer expanded docket detail when available
  const all = [
    ...(trellis.items || []),
    ...(expandedItems || []),
    ...(cl.items || []),
  ];

  // De-dupe by url
  const seen = new Set();
  const items = [];
  for (const it of all) {
    const key = it?.url || JSON.stringify(it);
    if (seen.has(key)) continue;
    seen.add(key);

    // Add simple risk scoring (non-criminal, non-definitive)
    const risk = computeLegalRiskForCase(it, q);

    items.push({
      ...it,
      role: it?.role ?? risk.role,
      risk_score: risk.score,
      risk_level: risk.risk_level,
    });
  }

  const errors = [trellis.error, cl.error].filter(Boolean);

  // Fallback: Web search for court records if both sources return nothing
  if (items.length === 0) {
    try {
      const links = await searchDuckDuckGo(`court records "${q}"`, {
        maxLinks: 5,
      });
      items.push(
        ...links.map((url) => ({
          type: "web_result",
          case_name: `Possible match for ${q}`,
          url,
          source: "Web Search",
          note: "Requires manual verification",
          risk_score: 0,
          risk_level: "Low",
        })),
      );
    } catch (e) {
      errors.push(`Web search failed: ${e.message}`);
    }
  }

  return { items, errors };
}

export async function criminalBackgroundByName(nameOrQuery) {
  // Best-effort: reuse court filings and flag probable criminal cases by heuristics
  const filings = await courtFilingsByName(nameOrQuery);
  let items = (filings.items || []).filter((it) => {
    const n = (it.case_name || "").toLowerCase();
    return /state\s+v\.|people\s+v\.|commonwealth\s+v\.|the\s+state/.test(n);
  });

  // Explicit web search for criminal records if heuristics find nothing
  if (items.length === 0) {
    try {
      const links = await searchDuckDuckGo(
        `criminal record arrest "${nameOrQuery}"`,
        { maxLinks: 5 },
      );
      items = links.map((url) => ({
        type: "web_result",
        case_name: `Possible criminal record for ${nameOrQuery}`,
        url,
        source: "Web Search",
      }));
    } catch {}
  }

  return { items, errors: filings.errors || [] };
}
