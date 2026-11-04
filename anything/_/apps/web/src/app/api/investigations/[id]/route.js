import { auth } from "@/auth";
import sql from "@/app/api/utils/sql";
import { logEvent } from "../utils/database.js";
import { regenerateInvestigation } from "../utils/regenerate.js";

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
      SELECT id, user_id, status, processing_flags FROM investigations
      WHERE id = ${id} AND user_id = ${session.user.id}
    `;
    if (rows.length === 0) {
      return Response.json(
        { error: "Investigation not found" },
        { status: 404 },
      );
    }

    // Recheck ownership, settings, state and lease under the row lock. All
    // cleanup and requeue commit together, never an empty report on failure.
    const regenerated = await regenerateInvestigation(sql, rows[0], session.user.id);
    if (regenerated.code) {
      return Response.json({
        error: regenerated.code === 'PROCESSING_FLAGS_REQUIRED'
          ? 'Saved collection settings must be restored before regeneration. Existing results were preserved.'
          : 'This investigation is running or changed. Existing results were preserved; refresh its status.',
        code: regenerated.code,
      }, { status: 409 });
    }

    try {
    await logEvent(
      sql,
      "investigation_regenerate_requested",
      "User requested AI regenerate",
      {
        investigation_id: id,
        user_id: session.user.id,
      },
    );
    } catch (error) {
      console.warn('Failed to log committed regeneration');
    }

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
