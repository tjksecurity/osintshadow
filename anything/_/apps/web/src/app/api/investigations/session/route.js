import { auth } from "@/auth";
import sql from "@/app/api/utils/sql";
import { checkAuthentication } from "../utils/auth.js";

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
    const sessionToken = url.searchParams.get("token");

    if (!sessionToken) {
      return Response.json(
        { error: "Missing session token", code: "MISSING_TOKEN" },
        { status: 400 },
      );
    }

    console.log("Looking up session token:", sessionToken);

    // Look up the session token in logs
    const results = await sql`
      SELECT metadata_json
      FROM logs 
      WHERE log_type = 'investigation_session_token' 
      AND metadata_json->>'session_token' = ${sessionToken}
      AND metadata_json->>'user_id' = ${String(userId)}
      AND created_at > NOW() - INTERVAL '1 hour'
      ORDER BY created_at DESC 
      LIMIT 1
    `;

    if (results.length === 0) {
      console.log("Session token not found or expired:", sessionToken);
      return Response.json(
        {
          error: "Session token not found or expired",
          code: "TOKEN_NOT_FOUND",
        },
        { status: 404 },
      );
    }

    const tokenData = results[0].metadata_json;
    const investigationId = tokenData.investigation_id;

    console.log("Found investigation ID for session token:", investigationId);

    // Verify the investigation belongs to this user
    const investigations = await sql`
      SELECT id, target_type, target_value, created_at
      FROM investigations 
      WHERE id = ${investigationId} AND user_id = ${userId}
    `;

    if (investigations.length === 0) {
      console.log("Investigation not found or unauthorized:", investigationId);
      return Response.json(
        { error: "Investigation not found", code: "INVESTIGATION_NOT_FOUND" },
        { status: 404 },
      );
    }

    const investigation = investigations[0];

    return Response.json({
      success: true,
      investigation_id: investigation.id,
      target_type: investigation.target_type,
      target_value: investigation.target_value,
      created_at: investigation.created_at,
    });
  } catch (error) {
    console.error("Error looking up session token:", error);
    return Response.json(
      { error: "Internal server error", details: error.message },
      { status: 500 },
    );
  }
}
