export function normalizeProfiles(usernameInfo, emailLocal) {
  const platformChecks = usernameInfo?.platform_checks || [];
  const usernameProfiles = usernameInfo?.profiles || [];

  if (platformChecks.length) {
    return platformChecks
      .filter((p) => p && (p.exists === true || p.exists === undefined))
      .map((p) => ({
        platform: p.platform,
        profile_url: p.url || p.profile_url,
        exists: p.exists !== false,
        followers: p.followers || p.follower_count || null,
        display_name: p.display_name || null,
        bio: p.bio || null,
        handle: p.handle || null,
        risk_hints: p.risk_hints || {},
      }));
  }

  return usernameProfiles
    .filter((p) => {
      if (!p) return false;
      const existsLike = p.exists === true || p.exists === undefined;
      const hasEvidence = !!(
        p.match_evidence &&
        Object.values(p.match_evidence).some((a) => (a || []).length > 0)
      );
      return existsLike || hasEvidence;
    })
    .map((p) => ({
      platform: p.platform,
      profile_url: p.profile_url,
      exists: p.exists !== false,
      followers: p.followers || null,
      display_name: p.meta?.display_name || null,
      bio: p.meta?.bio || null,
      handle: p.username || usernameInfo?.primary || emailLocal || null,
      risk_hints: p.risk_hints || {},
      platform_category: p.platform_category,
      match_evidence: p.match_evidence,
      confidence: p.confidence,
    }));
}
