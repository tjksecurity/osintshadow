import { auth } from "@/auth";
import sql from "@/app/api/utils/sql";

// IMPORTANT: progress endpoints must never be cached, otherwise the UI will
// appear "stuck" even while polling.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request, { params }) {
  // NEW: basic server-side timing so we can debug "polling but not updating" in production.
  const now = () =>
    typeof performance !== "undefined" && performance.now
      ? performance.now()
      : Date.now();
  const startedAt = now();
  let authMs = 0;
  let invQueryMs = 0;
  let eventsQueryMs = 0;

  try {
    const authStart = now();
    const session = await auth();
    authMs = now() - authStart;

    if (!session?.user?.id) {
      return Response.json(
        { error: "Unauthorized", code: "UNAUTHORIZED" },
        {
          status: 401,
          headers: {
            "Cache-Control":
              "no-store, no-cache, must-revalidate, proxy-revalidate",
            Pragma: "no-cache",
            Expires: "0",
            "Server-Timing": `auth;dur=${authMs.toFixed(1)},total;dur=${(now() - startedAt).toFixed(1)}`,
          },
        },
      );
    }

    const id = params?.id;

    const invStart = now();
    const invRows = await sql`
      SELECT id, user_id, status, created_at, completed_at
      FROM investigations
      WHERE id = ${id} AND user_id = ${session.user.id}
      LIMIT 1
    `;
    invQueryMs = now() - invStart;

    if (invRows.length === 0) {
      return Response.json(
        { error: "Investigation not found", code: "NOT_FOUND" },
        {
          status: 404,
          headers: {
            "Cache-Control":
              "no-store, no-cache, must-revalidate, proxy-revalidate",
            Pragma: "no-cache",
            Expires: "0",
            "Server-Timing": `auth;dur=${authMs.toFixed(1)},inv;dur=${invQueryMs.toFixed(1)},total;dur=${(now() - startedAt).toFixed(1)}`,
          },
        },
      );
    }

    const investigation = invRows[0];

    const eventsStart = now();
    const events = await sql`
      SELECT id, step_key, step_label, event_status, percent, message, created_at
      FROM investigation_progress_events
      WHERE investigation_id = ${id}
      ORDER BY id ASC
      LIMIT 200
    `;
    eventsQueryMs = now() - eventsStart;

    let percent = 0;
    let currentStep = null;

    if (events.length > 0) {
      const last = events[events.length - 1];
      currentStep = {
        step_key: last.step_key,
        step_label: last.step_label,
        event_status: last.event_status,
        percent: last.percent,
        message: last.message,
        created_at: last.created_at,
      };

      for (let i = events.length - 1; i >= 0; i -= 1) {
        const p = events[i]?.percent;
        if (typeof p === "number" && Number.isFinite(p)) {
          percent = p;
          break;
        }
      }
    }

    const lastEventId = events.length > 0 ? events[events.length - 1]?.id : 0;
    const totalMs = now() - startedAt;

    return Response.json(
      {
        investigation: {
          id: investigation.id,
          status: investigation.status,
          created_at: investigation.created_at,
          completed_at: investigation.completed_at,
        },
        percent,
        currentStep,
        events,
        // NEW: Put these in the JSON body too, so you can debug even if headers are stripped.
        lastEventId: Number(lastEventId || 0),
        timing: {
          authMs: Number(authMs.toFixed(1)),
          invMs: Number(invQueryMs.toFixed(1)),
          eventsMs: Number(eventsQueryMs.toFixed(1)),
          totalMs: Number(totalMs.toFixed(1)),
        },
        serverTime: new Date().toISOString(),
      },
      {
        headers: {
          // Tell browsers/CDNs to never cache this endpoint.
          "Cache-Control":
            "no-store, no-cache, must-revalidate, proxy-revalidate",
          Pragma: "no-cache",
          Expires: "0",
          // NEW: server timing info to debug prod performance/caching.
          "Server-Timing": `auth;dur=${authMs.toFixed(1)},inv;dur=${invQueryMs.toFixed(1)},events;dur=${eventsQueryMs.toFixed(1)},total;dur=${totalMs.toFixed(1)}`,
          // NEW: lets us confirm from the browser that each poll is seeing new progress data.
          "x-progress-last-event-id": String(lastEventId || 0),
        },
      },
    );
  } catch (error) {
    console.error("Error fetching investigation progress:", error);
    return Response.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      {
        status: 500,
        headers: {
          "Cache-Control":
            "no-store, no-cache, must-revalidate, proxy-revalidate",
          Pragma: "no-cache",
          Expires: "0",
          "Server-Timing": `total;dur=${(now() - startedAt).toFixed(1)}`,
        },
      },
    );
  }
}
