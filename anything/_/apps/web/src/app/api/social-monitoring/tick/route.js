import { auth } from "@/auth";
import sql from "@/app/api/utils/sql";
import { collectPostsForProfile } from "@/app/api/investigations/osint/social/postCollectors.js";
import { storeSocialPost } from "@/app/api/investigations/osint/social/database.js";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function cacheHeaders() {
  return {
    "Content-Type": "application/json",
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    Pragma: "no-cache",
    Expires: "0",
  };
}

export async function POST() {
  const headers = cacheHeaders();

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json(
        { error: "Unauthorized", code: "UNAUTHORIZED" },
        { status: 401, headers },
      );
    }

    // Find a small batch of due monitoring rows for this user.
    const rows = await sql`
      SELECT
        sm.id,
        sm.investigation_id,
        sm.platform,
        sm.target_username,
        sm.monitoring_active,
        sm.last_checked,
        sm.posts_collected,
        sm.api_calls_used,
        sm.error_count,
        sm.next_check_at
      FROM social_monitoring sm
      JOIN investigations i ON i.id = sm.investigation_id
      WHERE i.user_id = ${session.user.id}
        AND sm.monitoring_active = true
        AND (sm.next_check_at IS NULL OR sm.next_check_at <= NOW())
      ORDER BY sm.next_check_at NULLS FIRST, sm.id ASC
      LIMIT 5
    `;

    if (rows.length === 0) {
      return Response.json(
        { ok: true, processed: 0, message: "No monitoring checks due" },
        { headers },
      );
    }

    const processed = [];

    for (const row of rows) {
      const startedAt = Date.now();
      try {
        // Look up the matching social profile row.
        const profRows = await sql`
          SELECT
            id as profile_id,
            platform,
            username,
            display_name,
            profile_url,
            (COALESCE(risk_score, 0) / 100.0) as confidence_score
          FROM social_profiles
          WHERE investigation_id = ${row.investigation_id}
            AND platform = ${row.platform}
            AND username = ${row.target_username}
          ORDER BY id ASC
          LIMIT 1
        `;

        if (profRows.length === 0) {
          // Disable monitoring if the profile no longer exists.
          await sql`
            UPDATE social_monitoring
            SET monitoring_active = false,
                last_checked = NOW(),
                next_check_at = NULL,
                error_count = COALESCE(error_count, 0) + 1
            WHERE id = ${row.id}
          `;

          processed.push({
            id: row.id,
            platform: row.platform,
            username: row.target_username,
            ok: false,
            error: "Profile not found; monitoring disabled",
          });
          continue;
        }

        const profile = profRows[0];

        // Collect a small set of recent posts. (These are currently mocked for most platforms,
        // but the monitoring plumbing is real and will work when you swap to real APIs.)
        const posts = await collectPostsForProfile(profile, {
          maxPostsPerProfile: 10,
        });

        if (Array.isArray(posts)) {
          for (const post of posts) {
            await storeSocialPost(profile.profile_id, post);
          }
        }

        await sql`
          UPDATE social_monitoring
          SET last_checked = NOW(),
              api_calls_used = COALESCE(api_calls_used, 0) + 1,
              posts_collected = COALESCE(posts_collected, 0) + ${Array.isArray(posts) ? posts.length : 0},
              next_check_at = NOW() + INTERVAL '15 minutes'
          WHERE id = ${row.id}
        `;

        processed.push({
          id: row.id,
          platform: row.platform,
          username: row.target_username,
          ok: true,
          posts: Array.isArray(posts) ? posts.length : 0,
          ms: Date.now() - startedAt,
        });
      } catch (e) {
        console.error("social-monitoring tick failed", e);

        try {
          await sql`
            UPDATE social_monitoring
            SET last_checked = NOW(),
                api_calls_used = COALESCE(api_calls_used, 0) + 1,
                error_count = COALESCE(error_count, 0) + 1,
                next_check_at = NOW() + INTERVAL '30 minutes'
            WHERE id = ${row.id}
          `;
        } catch (_) {}

        processed.push({
          id: row.id,
          platform: row.platform,
          username: row.target_username,
          ok: false,
          error: e?.message || "Unknown error",
          ms: Date.now() - startedAt,
        });
      }
    }

    return Response.json(
      {
        ok: true,
        processed: processed.length,
        results: processed,
        serverTime: new Date().toISOString(),
      },
      { headers },
    );
  } catch (e) {
    console.error("Failed to run social monitoring tick", e);
    return Response.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500, headers },
    );
  }
}
