import { storeSocialPost, storePostAnalytics } from "./database.js";
import { collectPostsForProfile } from "./postCollectors.js";
import {
  analyzeProfileConnections,
  detectSuspiciousPatterns,
} from "./postAnalytics.js";

/**
 * Collect social media posts for timeline and correlation analysis
 */
export async function collectSocialPosts(
  investigationId,
  profiles,
  flags = {},
) {
  console.log(
    "📱 Starting social media post collection for",
    profiles.length,
    "profiles...",
  );

  const minProfileConfidence =
    typeof flags.minProfileConfidence === "number"
      ? Math.max(0, Math.min(1, flags.minProfileConfidence))
      : 0.65; // align with DEFAULT_MIN_CONFIDENCE used in profile discovery

  const allPosts = [];
  const postAnalytics = {
    total_posts: 0,
    platforms: {},
    mentions_found: [],
    hashtags_found: [],
    location_data: [],
    sentiment_summary: { positive: 0, negative: 0, neutral: 0 },
    time_patterns: {},
    connection_graph: [],
  };

  for (const profile of profiles) {
    const confidence =
      typeof profile.confidence_score === "number"
        ? profile.confidence_score
        : 0;
    if (confidence < minProfileConfidence) {
      continue;
    }

    try {
      console.log(
        `Collecting posts from ${profile.platform}:${profile.username}...`,
      );

      const posts = await collectPostsForProfile(profile, flags);

      if (posts && posts.length > 0) {
        // Store posts in database
        for (const post of posts) {
          await storeSocialPost(profile.profile_id, post);
          allPosts.push({
            ...post,
            profile_platform: profile.platform,
            profile_username: profile.username,
          });
        }

        // Update analytics
        postAnalytics.total_posts += posts.length;
        postAnalytics.platforms[profile.platform] =
          (postAnalytics.platforms[profile.platform] || 0) + posts.length;

        // Extract mentions and hashtags
        for (const post of posts) {
          if (post.mentions)
            postAnalytics.mentions_found.push(...post.mentions);
          if (post.hashtags)
            postAnalytics.hashtags_found.push(...post.hashtags);
          if (post.location_data)
            postAnalytics.location_data.push(post.location_data);

          // Time pattern analysis
          const hour = new Date(post.posted_at).getHours();
          postAnalytics.time_patterns[hour] =
            (postAnalytics.time_patterns[hour] || 0) + 1;
        }

        console.log(
          `✓ Collected ${posts.length} posts from ${profile.platform}:${profile.username}`,
        );
      }
    } catch (error) {
      console.error(
        `Failed to collect posts from ${profile.platform}:${profile.username}:`,
        error,
      );
    }
  }

  // Analyze connections between profiles
  postAnalytics.connection_graph = analyzeProfileConnections(allPosts);

  // Detect suspicious patterns
  const suspiciousPatterns = detectSuspiciousPatterns(allPosts, postAnalytics);

  // NEW: build a small preview to store in osint_raw so the UI can render posts
  const maxPreview = flags.maxPreviewPosts || 200;
  const postsPreview = allPosts.slice(0, maxPreview).map((p) => ({
    post_id: p.post_id,
    content: p.content,
    post_type: p.post_type,
    posted_at: p.posted_at,
    engagement_score: p.engagement_score,
    location_data: p.location_data,
    mentions: p.mentions,
    hashtags: p.hashtags,
    media_urls: p.media_urls,
    sentiment_score: p.sentiment_score,
    profile_platform: p.profile_platform,
    profile_username: p.profile_username,
  }));

  // Store aggregated post analytics + preview posts
  await storePostAnalytics(
    investigationId,
    postAnalytics,
    suspiciousPatterns,
    postsPreview,
  );

  console.log(
    `✅ Social post collection completed: ${postAnalytics.total_posts} posts from ${Object.keys(postAnalytics.platforms).length} platforms`,
  );

  return {
    posts: allPosts,
    analytics: postAnalytics,
    suspicious_patterns: suspiciousPatterns,
  };
}
