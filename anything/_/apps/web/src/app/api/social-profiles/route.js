import { auth } from "@/auth";
import sql from "@/app/api/utils/sql";
import { checkAuthentication } from "../investigations/utils/auth.js";

export async function GET(request) {
  try {
    const { authenticated, userId } = await checkAuthentication(auth);
    if (!authenticated) {
      return Response.json(
        { error: "Unauthorized", code: "UNAUTHORIZED" },
        { status: 401 },
      );
    }

    const url = new URL(request.url);
    const investigationId = url.searchParams.get("investigation_id");
    const platform = url.searchParams.get("platform"); // Optional filter
    const includeMonitoring =
      url.searchParams.get("include_monitoring") === "true";

    if (!investigationId) {
      return Response.json(
        { error: "investigation_id is required", code: "MISSING_PARAM" },
        { status: 400 },
      );
    }

    // Verify the user owns this investigation
    const [investigation] = await sql`
      SELECT id FROM investigations WHERE id = ${investigationId} AND user_id = ${userId}
    `;

    if (!investigation) {
      return Response.json(
        { error: "Investigation not found", code: "NOT_FOUND" },
        { status: 404 },
      );
    }

    // Build the profiles query with optional platform filter
    let profilesQuery = `
      SELECT 
        sp.*,
        COUNT(spo.id) as posts_count,
        MAX(spo.posted_at) as latest_post_date
      FROM social_profiles sp
      LEFT JOIN social_posts spo ON sp.id = spo.profile_id
      WHERE sp.investigation_id = $1
    `;
    const params = [investigationId];

    if (platform) {
      profilesQuery += ` AND sp.platform = $${params.length + 1}`;
      params.push(platform);
    }

    profilesQuery += `
      GROUP BY sp.id
      ORDER BY sp.risk_score DESC, sp.created_at DESC
    `;

    const profiles = await sql(profilesQuery, params);

    // Get monitoring status if requested
    let monitoringData = null;
    if (includeMonitoring) {
      const monitoringQuery = `
        SELECT platform, target_username, monitoring_active, last_checked, 
               posts_collected, next_check_at, error_count
        FROM social_monitoring 
        WHERE investigation_id = $1
      `;
      monitoringData = await sql(monitoringQuery, [investigationId]);
    }

    // Get platform summary
    const platformSummary = await sql`
      SELECT 
        platform,
        COUNT(*) as profile_count,
        AVG(risk_score) as avg_risk_score,
        MAX(risk_score) as max_risk_score,
        SUM(CASE WHEN verified = true THEN 1 ELSE 0 END) as verified_count
      FROM social_profiles
      WHERE investigation_id = ${investigationId}
      GROUP BY platform
      ORDER BY profile_count DESC
    `;

    const response = {
      profiles: profiles.map((profile) => ({
        ...profile,
        metadata_json:
          typeof profile.metadata_json === "string"
            ? JSON.parse(profile.metadata_json)
            : profile.metadata_json,
      })),
      platform_summary: platformSummary,
      monitoring: monitoringData || undefined,
      total_profiles: profiles.length,
      total_platforms: platformSummary.length,
    };

    return Response.json(response);
  } catch (error) {
    console.error("Error fetching social profiles:", error);
    return Response.json(
      { error: "Internal server error", details: error.message },
      { status: 500 },
    );
  }
}

export async function POST(request) {
  try {
    const { authenticated, userId } = await checkAuthentication(auth);
    if (!authenticated) {
      return Response.json(
        { error: "Unauthorized", code: "UNAUTHORIZED" },
        { status: 401 },
      );
    }

    const body = await request.json();
    const {
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
      confidence_score,
      metadata,
    } = body;

    if (!investigation_id || !platform || !username) {
      return Response.json(
        {
          error: "investigation_id, platform, and username are required",
          code: "MISSING_FIELDS",
        },
        { status: 400 },
      );
    }

    // Verify the user owns this investigation
    const [investigation] = await sql`
      SELECT id FROM investigations WHERE id = ${investigation_id} AND user_id = ${userId}
    `;

    if (!investigation) {
      return Response.json(
        { error: "Investigation not found", code: "NOT_FOUND" },
        { status: 404 },
      );
    }

    // Insert the social profile
    const [newProfile] = await sql`
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
        ${investigation_id},
        ${platform},
        ${username},
        ${display_name || null},
        ${profile_url || null},
        ${bio || null},
        ${followers_count || null},
        ${following_count || null},
        ${posts_count || null},
        ${verified || false},
        ${profile_image_url || null},
        ${account_created_date || null},
        ${last_active || null},
        ${discovery_method || null},
        ${Math.round((confidence_score || 0) * 100)},
        ${JSON.stringify(metadata || {})}
      )
      RETURNING *
    `;

    return Response.json(
      {
        success: true,
        profile: {
          ...newProfile,
          metadata_json:
            typeof newProfile.metadata_json === "string"
              ? JSON.parse(newProfile.metadata_json)
              : newProfile.metadata_json,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Error creating social profile:", error);
    return Response.json(
      { error: "Internal server error", details: error.message },
      { status: 500 },
    );
  }
}

export async function PATCH(request) {
  try {
    const { authenticated, userId } = await checkAuthentication(auth);
    if (!authenticated) {
      return Response.json(
        { error: "Unauthorized", code: "UNAUTHORIZED" },
        { status: 401 },
      );
    }

    const body = await request.json();
    const { profile_id, risk_score, notes } = body;

    if (!profile_id) {
      return Response.json(
        { error: "profile_id is required", code: "MISSING_PARAM" },
        { status: 400 },
      );
    }

    // Verify the user owns this profile through the investigation
    const [profile] = await sql`
      SELECT sp.id 
      FROM social_profiles sp
      JOIN investigations i ON sp.investigation_id = i.id
      WHERE sp.id = ${profile_id} AND i.user_id = ${userId}
    `;

    if (!profile) {
      return Response.json(
        { error: "Profile not found", code: "NOT_FOUND" },
        { status: 404 },
      );
    }

    // Build update query
    const updates = [];
    const params = [];
    let paramIndex = 1;

    if (risk_score !== undefined) {
      updates.push(`risk_score = $${paramIndex++}`);
      params.push(Math.max(0, Math.min(100, risk_score))); // Clamp between 0-100
    }

    if (notes !== undefined) {
      updates.push(`metadata_json = metadata_json || $${paramIndex++}::jsonb`);
      params.push(JSON.stringify({ notes }));
    }

    if (updates.length === 0) {
      return Response.json(
        { error: "No updates provided", code: "NO_UPDATES" },
        { status: 400 },
      );
    }

    params.push(profile_id);
    const updateQuery = `
      UPDATE social_profiles 
      SET ${updates.join(", ")}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const [updatedProfile] = await sql(updateQuery, params);

    return Response.json({
      success: true,
      profile: {
        ...updatedProfile,
        metadata_json:
          typeof updatedProfile.metadata_json === "string"
            ? JSON.parse(updatedProfile.metadata_json)
            : updatedProfile.metadata_json,
      },
    });
  } catch (error) {
    console.error("Error updating social profile:", error);
    return Response.json(
      { error: "Internal server error", details: error.message },
      { status: 500 },
    );
  }
}
