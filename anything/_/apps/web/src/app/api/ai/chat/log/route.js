import { auth } from "@/auth";
import sql from "@/app/api/utils/sql";

export async function POST(request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const {
      action = "event",
      // Default to Haiku to match /ai/chat page
      model = "anthropic-claude-haiku",
      content = "",
      prompt = "",
      duration_ms = null,
      messages_count = null,
      extra = null,
    } = body || {};

    // Fetch user info for email + role once
    const urows =
      await sql`SELECT id, email, role FROM auth_users WHERE id = ${session.user.id}`;
    const me = urows[0];

    const preview = String(content || prompt || "").slice(0, 300);

    // Insert into logs table
    await sql`
      INSERT INTO logs (log_type, message, metadata_json)
      VALUES (
        ${"ai_chat"},
        ${action === "assistant_message" ? "AI chat assistant message" : action === "user_message" ? "AI chat user message" : "AI chat event"},
        ${{
          user_id: me?.id,
          email: (me?.email || "").toLowerCase(),
          action,
          model,
          prompt: prompt ? String(prompt).slice(0, 2000) : undefined,
          content_preview: preview,
          duration_ms,
          messages_count,
          extra,
        }}
      )
    `;

    return Response.json({ ok: true });
  } catch (e) {
    console.error("ai chat log error", e);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
