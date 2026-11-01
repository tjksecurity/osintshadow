import { uniq, asArray, clamp } from "../utils/helpers.js";

export function buildIdentityGraph(
  osintData,
  baseEmail,
  emailLocal,
  emailDomain,
  phoneCandidates,
  emailInfo,
  usernameInfo,
  domainInfo,
  ipNetInfo,
  deepInfo,
  existingProfiles,
) {
  const derivedUsernames = uniq([
    ...(emailInfo?.derived_usernames || []),
    usernameInfo?.primary || null,
    ...(usernameInfo?.handles || []),
    emailLocal,
  ]);

  const handleMap = new Map();
  for (const h of derivedUsernames) {
    if (!h) continue;
    handleMap.set(h, { handle: h, platforms: [] });
  }
  for (const prof of existingProfiles) {
    const handle = prof.handle || emailLocal || usernameInfo?.primary || null;
    if (!handle) continue;
    if (!handleMap.has(handle))
      handleMap.set(handle, { handle, platforms: [] });
    handleMap.get(handle).platforms.push(prof);
  }
  const handles = Array.from(handleMap.values()).map((h) => ({
    ...h,
    confidence: clamp(
      h.platforms.length * 0.2 +
        (emailLocal &&
        h.handle &&
        h.handle.toLowerCase() === emailLocal.toLowerCase()
          ? 0.2
          : 0),
      0,
      1,
    ),
  }));

  const identityGraph = {
    emails: uniq([baseEmail].filter(Boolean)),
    domains: uniq([
      emailDomain,
      domainInfo?.domain_info?.domain,
      ...(asArray(domainInfo?.subdomains) || [])
        .map((s) => (typeof s === "string" ? s : s?.host))
        .filter(Boolean),
    ]),
    ips: uniq([
      ...(asArray(ipNetInfo?.ips) || []).map((i) => i?.ip).filter(Boolean),
      ...(asArray(domainInfo?.a_records) || [])
        .map((r) => r?.data || r?.ip)
        .filter(Boolean),
    ]),
    // A user-supplied phone is a search target, not ownership evidence. Public
    // page candidates stay separate and never create identity graph links.
    phones: uniq([
      osintData?.target_type === "phone" ? osintData?.target_value : null,
      osintData?.phone?.normalized,
      osintData?.phone?.original,
    ]).filter(Boolean),
    phone_candidates: [],
    handles,
    links: [],
  };

  const candidateByDigits = new Map();
  for (const candidate of [
    ...(phoneCandidates || []),
    ...(deepInfo?.aggregate?.phones || []),
  ]) {
    if (candidate?.digits && !candidateByDigits.has(candidate.digits)) {
      candidateByDigits.set(candidate.digits, candidate);
    }
  }
  identityGraph.phone_candidates = Array.from(candidateByDigits.values());

  if (emailLocal) {
    for (const h of handles) {
      if (h.handle && h.handle.toLowerCase() === emailLocal.toLowerCase()) {
        identityGraph.links.push({
          source: `handle:${h.handle}`,
          target: `email:${baseEmail}`,
          reason: "email local-part matches handle",
          weight: 0.8,
        });
      }
    }
  }

  for (const p of existingProfiles) {
    const ev = p.match_evidence || {};
    (ev.phones || []).forEach((ph) =>
      identityGraph.links.push({
        source: `profile:${p.platform}`,
        target: `phone:${ph}`,
        reason: "phone match on profile page",
        weight: 0.7,
      }),
    );
    (ev.emails || []).forEach((em) =>
      identityGraph.links.push({
        source: `profile:${p.platform}`,
        target: `email:${em}`,
        reason: "email match on profile page",
        weight: 0.6,
      }),
    );
    (ev.domains || []).forEach((d) =>
      identityGraph.links.push({
        source: `profile:${p.platform}`,
        target: `domain:${d}`,
        reason: "domain mentioned on profile page",
        weight: 0.5,
      }),
    );
  }

  return identityGraph;
}
