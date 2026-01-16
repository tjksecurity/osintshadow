import { auth } from "@/auth";
import sql from "@/app/api/utils/sql";
import { insertProgressEvent, logEvent } from "../../utils/database.js";

export async function POST(request, { params }) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json(
        { error: "Unauthorized", code: "UNAUTHORIZED" },
        { status: 401 },
      );
    }

    const id = params?.id;
    if (!id) {
      return Response.json(
        { error: "Missing investigation id", code: "MISSING_ID" },
        { status: 400 },
      );
    }

    // Atomically claim this investigation for processing.
    const claimed = await sql`
      UPDATE investigations
      SET status = 'processing'
      WHERE id = ${id} AND user_id = ${session.user.id} AND status = 'queued'
      RETURNING id
    `;

    // If it was already processing/completed/failed, just return that fact.
    if (claimed.length === 0) {
      const rows = await sql`
        SELECT id, status
        FROM investigations
        WHERE id = ${id} AND user_id = ${session.user.id}
        LIMIT 1
      `;

      if (rows.length === 0) {
        return Response.json(
          { error: "Investigation not found", code: "NOT_FOUND" },
          { status: 404 },
        );
      }

      return Response.json({
        ok: true,
        message: `No start needed (status=${rows[0].status})`,
        id: rows[0].id,
        status: rows[0].status,
      });
    }

    // Write a "starting" progress event so the UI updates immediately.
    try {
      await insertProgressEvent(sql, id, {
        stepKey: "start",
        stepLabel: "Starting investigation",
        eventStatus: "started",
        percent: 1,
        message: "Processing started",
      });
    } catch (e) {
      console.warn("Failed to insert start progress event", e);
    }

    try {
      await logEvent(
        sql,
        "investigation_start",
        "Investigation start requested",
        {
          investigation_id: id,
          user_id: session.user.id,
        },
      );
    } catch (e) {
      console.warn("Failed to log investigation_start", e);
    }

    // IMPORTANT:
    // We do NOT run the entire investigation pipeline in this endpoint.
    // On the published site, long-running work can be killed mid-flight.
    // Instead, the investigation page calls /tick repeatedly to advance steps.

    return Response.json(
      {
        ok: true,
        id: Number(id),
        status: "processing",
        message: "Processing started (step runner active)",
      },
      { status: 202 },
    );
  } catch (error) {
    console.error("Error starting investigation:", error);
    return Response.json(
      {
        error: "Failed to start investigation",
        code: "START_FAILED",
        details: error?.message || "Unknown error",
      },
      { status: 500 },
    );
  }
}
