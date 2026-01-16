import { uniq, asArray } from "../utils/helpers.js";

// Certain profile hubs often return generic or "no bio found" pages that
// aren't strong evidence for confirmed data. We treat them as weak sources
// and avoid using them as the sole reason to confirm a phone.
const WEAK_HUB_HOSTS = ["tap.bio"]; // can be extended if needed

function isWeakHubSource(url) {
  if (!url) return false;
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    return WEAK_HUB_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
  } catch {
    // Fallback for non-absolute URLs – simple substring check
    return url.toLowerCase().includes("tap.bio/");
  }
}

export function extractConfirmedData(
  analysis,
  osintData,
  baseEmail,
  emailLocal,
  emailDomain,
  existingProfiles,
) {
  try {
    const linkEvidence = analysis.identity_graph.links || [];
    const phoneSeedMap = new Map(
      (asArray(osintData?.phone_seeds) || [])
        .map((p) => [String(p?.digits || p), p])
        .filter(([k]) => !!k),
    );
    const emailSeedSet = new Set(
      (asArray(osintData?.email_seeds) || [])
        .map((e) => String(e?.email || e).toLowerCase())
        .filter(Boolean),
    );

    const profilesConfirmed = existingProfiles
      .map((p) => {
        const ev = p.match_evidence || {};
        const hasEv = Object.values(ev).some((a) => (a || []).length > 0);
        const strong = Number(p.confidence || 0) >= 0.7 || hasEv || p.exists;
        const reasons = [];
        if (Number(p.confidence || 0) >= 0.7) reasons.push("high confidence");
        if (p.exists) reasons.push("page exists");
        if (hasEv) reasons.push("on-page evidence");
        return strong
          ? {
              platform: p.platform,
              url: p.profile_url,
              handle: p.handle,
              confidence: p.confidence,
              platform_category: p.platform_category,
              reasons,
              evidence: ev,
            }
          : null;
      })
      .filter(Boolean);

    const phonesConfirmed = (analysis.identity_graph.phones || [])
      .map((ph) => {
        const digits = String(ph).replace(/\D/g, "");
        const links = linkEvidence
          .filter((l) => l.target === `phone:${ph}`)
          .map((l) => ({
            source: l.source,
            reason: l.reason,
            weight: l.weight,
          }));
        const seed = phoneSeedMap.get(digits);
        const reasons = [];

        if (links.length) reasons.push("mentioned on profile page(s)");

        const seedUrl = seed?.source_url || null;
        const hasGoodSeed = !!seedUrl && !isWeakHubSource(seedUrl);
        if (hasGoodSeed) {
          reasons.push("found on public hub/contact page");
        }

        // Only treat it as strongly confirmed if there is on-page evidence
        // or a non-weak hub/source backing it. This avoids noisy sources
        // like generic tap.bio pages showing up as confirmed.
        const strong = links.length > 0 || hasGoodSeed;

        return strong
          ? {
              phone: ph,
              sources: {
                profile_links: links,
                seed_source_url: hasGoodSeed ? seedUrl : null,
              },
              reasons,
            }
          : null;
      })
      .filter(Boolean);

    const emailsConfirmed = uniq([
      baseEmail,
      ...Array.from(emailSeedSet.values()),
    ])
      .map((em) => String(em).toLowerCase())
      .map((em) => {
        const links = linkEvidence
          .filter((l) => l.target === `email:${em}`)
          .map((l) => ({
            source: l.source,
            reason: l.reason,
            weight: l.weight,
          }));
        const inSeeds = emailSeedSet.has(em);
        const reasons = [];
        if (links.length) reasons.push("mentioned on profile page(s)");
        if (inSeeds) reasons.push("found on public hub/contact page");
        const strong = links.length > 0 || inSeeds || em === baseEmail;
        return strong
          ? {
              email: em,
              sources: { profile_links: links, seeded: inSeeds },
              reasons,
            }
          : null;
      })
      .filter(Boolean);

    const domainsConfirmed = uniq(analysis.identity_graph.domains || [])
      .map((d) => String(d).toLowerCase())
      .map((d) => {
        const links = linkEvidence
          .filter((l) => l.target === `domain:${d}`)
          .map((l) => ({
            source: l.source,
            reason: l.reason,
            weight: l.weight,
          }));
        const reasons = [];
        if (links.length) reasons.push("mentioned on profile page(s)");
        const strong = links.length > 0 || d === emailDomain;
        return strong
          ? { domain: d, sources: { profile_links: links }, reasons }
          : null;
      })
      .filter(Boolean);

    const handlesConfirmed = analysis.identity_graph.handles
      .map((h) => {
        const reasons = [];
        if ((h.confidence || 0) >= 0.6) reasons.push("multi-platform match");
        if (
          emailLocal &&
          h.handle &&
          h.handle.toLowerCase() === String(emailLocal).toLowerCase()
        )
          reasons.push("matches email local-part");
        const strong = (h.confidence || 0) >= 0.6 || reasons.length > 0;
        return strong
          ? { handle: h.handle, confidence: h.confidence, reasons }
          : null;
      })
      .filter(Boolean);

    return {
      generated_at: new Date().toISOString(),
      criteria: {
        profile_min_confidence: 0.7,
        handle_min_confidence: 0.6,
        evidence_required_if_low_confidence: true,
      },
      profiles: profilesConfirmed,
      phones: phonesConfirmed,
      emails: emailsConfirmed,
      domains: domainsConfirmed,
      handles: handlesConfirmed,
    };
  } catch (e) {
    console.error("confirmed_data extraction failed", e);
    return undefined;
  }
}
