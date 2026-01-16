/**
 * Analyze connections between profiles based on posts
 */
export function analyzeProfileConnections(posts) {
  const connections = [];
  const profileMentions = new Map();

  // Track who mentions whom
  for (const post of posts) {
    const poster = `${post.profile_platform}:${post.profile_username}`;

    if (post.mentions && post.mentions.length > 0) {
      for (const mention of post.mentions) {
        const key = `${poster} -> ${mention}`;
        if (!profileMentions.has(key)) {
          profileMentions.set(key, { count: 0, posts: [] });
        }
        profileMentions.get(key).count++;
        profileMentions.get(key).posts.push(post.post_id);
      }
    }
  }

  // Convert to connection graph format
  for (const [key, data] of profileMentions) {
    const [source, target] = key.split(" -> ");
    connections.push({
      source,
      target,
      weight: data.count,
      evidence_posts: data.posts.slice(0, 5), // First 5 post IDs as evidence
      connection_type: "mention",
    });
  }

  return connections;
}

/**
 * Detect suspicious patterns in social media posts
 */
export function detectSuspiciousPatterns(posts, analytics) {
  const patterns = [];

  // Pattern 1: Unusual posting times (late night/early morning)
  const nightPosts = Object.entries(analytics.time_patterns)
    .filter(([hour, count]) => (hour >= 23 || hour <= 5) && count > 5)
    .reduce((sum, [hour, count]) => sum + count, 0);

  if (nightPosts > analytics.total_posts * 0.3) {
    patterns.push({
      type: "unusual_posting_hours",
      severity: "medium",
      description: `${nightPosts} posts during late night/early morning hours (23:00-05:00)`,
      evidence: { night_posts: nightPosts, total_posts: analytics.total_posts },
    });
  }

  // Pattern 2: Suspicious location inconsistencies
  if (analytics.location_data.length > 3) {
    const uniqueCountries = new Set(
      analytics.location_data.map((loc) => loc.country),
    ).size;
    const uniqueCities = new Set(
      analytics.location_data.map((loc) => `${loc.city}, ${loc.country}`),
    ).size;

    if (uniqueCountries > 3 || uniqueCities > 10) {
      patterns.push({
        type: "location_inconsistency",
        severity: "high",
        description: `Posts from ${uniqueCountries} countries and ${uniqueCities} cities`,
        evidence: { countries: uniqueCountries, cities: uniqueCities },
      });
    }
  }

  // Pattern 3: High volume posting (potential automation)
  const postsPerDay = analytics.total_posts / 30; // Assume 30-day window
  if (postsPerDay > 20) {
    patterns.push({
      type: "high_volume_posting",
      severity: "medium",
      description: `Averaging ${Math.round(postsPerDay)} posts per day`,
      evidence: { posts_per_day: postsPerDay },
    });
  }

  // Pattern 4: Repeated hashtags (potential coordination)
  const hashtagCounts = {};
  for (const hashtag of analytics.hashtags_found) {
    hashtagCounts[hashtag] = (hashtagCounts[hashtag] || 0) + 1;
  }

  const repeatedHashtags = Object.entries(hashtagCounts)
    .filter(([tag, count]) => count > 10)
    .map(([tag, count]) => ({ tag, count }));

  if (repeatedHashtags.length > 0) {
    patterns.push({
      type: "repeated_hashtags",
      severity: "low",
      description: `Frequent use of specific hashtags`,
      evidence: { repeated_hashtags: repeatedHashtags.slice(0, 5) },
    });
  }

  return patterns;
}
