import { auth } from "@/auth";
import sql from "@/app/api/utils/sql";
import { logEvent, insertProgressEvent } from "../utils/database.js";

export async function GET(request, { params }) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;

    // Get investigation with primary joined data (AI, report, one OSINT blob)
    const investigation = await sql`
      SELECT i.*, 
             ai.summary, ai.anomalies, ai.risk_score, ai.full_json as ai_analysis,
             r.html_content, r.pdf_url,
             or_data.data_json as osint_data
      FROM investigations i
      LEFT JOIN ai_output ai ON i.id = ai.investigation_id
      LEFT JOIN reports r ON i.id = r.investigation_id
      LEFT JOIN osint_raw or_data ON i.id = or_data.investigation_id
      WHERE i.id = ${id} AND i.user_id = ${session.user.id}
    `;

    if (investigation.length === 0) {
      return Response.json(
        { error: "Investigation not found" },
        { status: 404 },
      );
    }

    // Get ALL OSINT raw rows for this investigation so views that expect an array can work
    const osintRaw = await sql`
      SELECT id, data_json, created_at
      FROM osint_raw
      WHERE investigation_id = ${id}
      ORDER BY created_at ASC, id ASC
    `;

    // Get geo markers
    const geoMarkers = await sql`
      SELECT * FROM geo_markers 
      WHERE investigation_id = ${id}
    `;

    const result = {
      ...investigation[0],
      geo_markers: geoMarkers,
      // NEW: expose full OSINT raw rows as an array for consumers like SocialPostsTab
      osint_raw: osintRaw,
    };

    return Response.json(result);
  } catch (error) {
    console.error("Error fetching investigation:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;

    // Ensure the investigation exists and belongs to the user
    const rows = await sql`
      SELECT id, user_id, target_type, target_value FROM investigations
      WHERE id = ${id} AND user_id = ${session.user.id}
    `;
    if (rows.length === 0) {
      return Response.json(
        { error: "Investigation not found" },
        { status: 404 },
      );
    }

    // Clean previous generated data to avoid duplicate rows on LEFT JOINs
    await sql`DELETE FROM ai_output WHERE investigation_id = ${id}`;
    await sql`DELETE FROM osint_raw WHERE investigation_id = ${id}`;
    await sql`DELETE FROM geo_markers WHERE investigation_id = ${id}`;
    await sql`DELETE FROM reports WHERE investigation_id = ${id}`;

    // clear live progress events so the progress panel matches the fresh run
    await sql`DELETE FROM investigation_progress_events WHERE investigation_id = ${id}`;

    // clean previously discovered social data for this investigation
    await sql`
      DELETE FROM social_posts
      WHERE profile_id IN (
        SELECT id FROM social_profiles WHERE investigation_id = ${id}
      )
    `;
    await sql`DELETE FROM social_monitoring WHERE investigation_id = ${id}`;
    await sql`DELETE FROM social_profiles WHERE investigation_id = ${id}`;

    // Reset status + completion timestamp (processing will be started by the detail page)
    await sql`
      UPDATE investigations
      SET status = 'queued', completed_at = NULL
      WHERE id = ${id}
    `;

    // Immediately write a first progress event so the UI shows movement
    await insertProgressEvent(sql, id, {
      stepKey: "queued",
      stepLabel: "Queued",
      eventStatus: "info",
      percent: 1,
      message: "Regeneration queued",
    });

    await logEvent(
      sql,
      "investigation_regenerate_requested",
      "User requested AI regenerate",
      {
        investigation_id: id,
        user_id: session.user.id,
      },
    );

    // IMPORTANT: do NOT attempt to background-run processing here.
    // In production serverless environments, work scheduled after the response
    // often never runs. Instead, the investigation detail page triggers
    // POST /api/investigations/:id/start when it sees status=queued.

    return Response.json({ message: "Regeneration queued", id });
  } catch (error) {
    console.error("Error regenerating investigation:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;

    // Check if investigation belongs to user
    const investigation = await sql`
      SELECT id FROM investigations 
      WHERE id = ${id} AND user_id = ${session.user.id}
    `;

    if (investigation.length === 0) {
      return Response.json(
        { error: "Investigation not found" },
        { status: 404 },
      );
    }

    // Delete investigation (cascade will handle related records)
    await sql`
      DELETE FROM investigations 
      WHERE id = ${id}
    `;

    await sql`
      INSERT INTO logs (log_type, message, metadata_json)
      VALUES ('investigation_deleted', 'Investigation deleted by user', ${JSON.stringify(
        {
          investigation_id: id,
          user_id: session.user.id,
        },
      )})
    `;

    return Response.json({ message: "Investigation deleted successfully" });
  } catch (error) {
    console.error("Error deleting investigation:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
