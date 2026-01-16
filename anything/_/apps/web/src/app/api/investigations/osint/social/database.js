import sql from "@/app/api/utils/sql.js";

/**
 * Store social profile in database
 */
export async function createSocialProfile(investigationId, profile) {
  try {
    const [result] = await sql`
      INSERT INTO social_profiles (
        investigation_id,
        platform,
        username,
        display_name,
        profile_url,
        bio,
        followers_count,
        following_count,
        posts_count,
        verified,
        profile_image_url,
        account_created_date,
        last_active,
        discovery_method,
        risk_score,
        metadata_json
      ) VALUES (
        ${investigationId},
        ${profile.platform},
        ${profile.username || null},
        ${profile.display_name || null},
        ${profile.profile_url || null},
        ${profile.bio || null},
        ${profile.followers_count || null},
        ${profile.following_count || null},
        ${profile.posts_count || null},
        ${profile.verified || false},
        ${profile.profile_image_url || null},
        ${profile.account_created_date || null},
        ${profile.last_active || null},
        ${profile.discovery_method || null},
        ${Math.round((profile.confidence_score || 0) * 100)},
        ${JSON.stringify(profile.metadata || {})}
      )
      RETURNING id
    `;

    console.log(`✓ Stored ${profile.platform} profile:`, profile.username);
    return result.id;
  } catch (error) {
    console.error("Failed to store social profile:", error);
    throw error;
  }
}

/**
 * Store individual social media post in database
 *
 * NOTE: We intentionally avoid ON CONFLICT here because the table may not have
 * a unique constraint on (profile_id, post_id). Instead, we do a lightweight
 * upsert manually.
 */
export async function storeSocialPost(profileId, post) {
  try {
    const postId = post?.post_id;
    if (!postId) {
      return;
    }

    const existing = await sql`
      SELECT id FROM social_posts
      WHERE profile_id = ${profileId} AND post_id = ${postId}
      LIMIT 1
    `;

    if (existing.length > 0) {
      await sql`
        UPDATE social_posts
        SET
          content = ${post.content || null},
          post_type = ${post.post_type || "text"},
          posted_at = ${new Date(post.posted_at)},
          engagement_score = ${post.engagement_score || 0},
          location_data = ${post.location_data ? JSON.stringify(post.location_data) : null},
          mentions = ${post.mentions ? JSON.stringify(post.mentions) : null},
          hashtags = ${post.hashtags ? JSON.stringify(post.hashtags) : null},
          media_urls = ${post.media_urls ? JSON.stringify(post.media_urls) : null},
          sentiment_score = ${post.sentiment_score || 0}
        WHERE id = ${existing[0].id}
      `;
      return;
    }

    await sql`
      INSERT INTO social_posts (
        profile_id,
        post_id,
        content,
        post_type,
        posted_at,
        engagement_score,
        location_data,
        mentions,
        hashtags,
        media_urls,
        sentiment_score
      ) VALUES (
        ${profileId},
        ${postId},
        ${post.content || null},
        ${post.post_type || "text"},
        ${new Date(post.posted_at)},
        ${post.engagement_score || 0},
        ${post.location_data ? JSON.stringify(post.location_data) : null},
        ${post.mentions ? JSON.stringify(post.mentions) : null},
        ${post.hashtags ? JSON.stringify(post.hashtags) : null},
        ${post.media_urls ? JSON.stringify(post.media_urls) : null},
        ${post.sentiment_score || 0}
      )
    `;
  } catch (error) {
    console.error("Failed to store social post:", error);
  }
}

/**
 * Store post analytics in database
 *
 * We also store a small preview of posts so the UI can render posts even if it
 * isn't querying the social_posts table directly.
 */
export async function storePostAnalytics(
  investigationId,
  analytics,
  suspiciousPatterns,
  postsPreview = [],
) {
  try {
    await sql`
      INSERT INTO osint_raw (investigation_id, data_json)
      VALUES (${investigationId}, ${JSON.stringify({
        type: "social_posts_analytics",
        analytics,
        suspicious_patterns: suspiciousPatterns,
        posts: postsPreview,
        timestamp: new Date().toISOString(),
      })})
    `;
  } catch (error) {
    console.error("Failed to store post analytics:", error);
  }
}
