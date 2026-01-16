import { auth } from "@/auth";
import sql from "@/app/api/utils/sql";

async function sendEmail({ to, subject, html, text }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from =
    process.env.EMAIL_FROM || "ShadowTrace <no-reply@osintshadow.com>";
  if (!apiKey) {
    return { sent: false, reason: "missing_resend_api_key" };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to, subject, html, text }),
    });
    if (!res.ok) {
      const errTxt = await res.text();
      console.error("resend error", res.status, errTxt);
      return { sent: false, reason: `resend_${res.status}` };
    }
    return { sent: true };
  } catch (e) {
    console.error("resend exception", e);
    return { sent: false, reason: "exception" };
  }
}

function escapeHtml(str = "") {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export async function POST(request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const urows =
      await sql`SELECT email, role FROM auth_users WHERE id = ${session.user.id}`;
    const me = urows[0];
    const isAdmin =
      me?.role === "admin" ||
      (me?.email || "").toLowerCase() === "glossontravis@gmail.com";
    if (!isAdmin) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    // Load AI chat logs for last 7 days
    const rows = await sql`
      SELECT id, message, metadata_json, created_at
      FROM logs
      WHERE log_type = ${"ai_chat"}
        AND created_at >= now() - interval '7 days'
      ORDER BY created_at ASC
    `;

    // Aggregate
    const totalEvents = rows.length;
    let userMessageCount = 0;
    let assistantMessageCount = 0;
    const byUser = new Map();
    const samples = [];

    for (const r of rows) {
      const m = r.metadata_json || {};
      const email = (m.email || "unknown").toLowerCase();
      const action = m.action || "event";
      if (action === "user_message") userMessageCount++;
      if (action === "assistant_message") assistantMessageCount++;
      const rec = byUser.get(email) || { count: 0, user: email, prompts: 0 };
      rec.count++;
      if (action === "user_message") rec.prompts++;
      byUser.set(email, rec);
      if (m.prompt) {
        samples.push({ email, prompt: m.prompt, at: r.created_at });
      }
    }

    const users = Array.from(byUser.values()).sort((a, b) => b.count - a.count);
    const uniqueUsers = users.length;

    // Build HTML report
    const rowsHtml = users
      .slice(0, 20)
      .map(
        (u, i) => `
        <tr>
          <td style="padding:6px 8px;border-bottom:1px solid #eee;">${i + 1}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #eee;">${escapeHtml(u.user)}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #eee;">${u.prompts}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #eee;">${u.count}</td>
        </tr>`,
      )
      .join("");

    const sampleHtml = samples
      .slice(-10)
      .map(
        (s) => `
        <div style="margin:8px 0;padding:8px;background:#f7f7f7;border:1px solid #eee;border-radius:6px;">
          <div style="font-size:12px;color:#666;">${new Date(s.at).toLocaleString()} — ${escapeHtml(
            s.email,
          )}</div>
          <div style="white-space:pre-wrap;">${escapeHtml(s.prompt.slice(0, 500))}</div>
        </div>`,
      )
      .join("");

    const html = `
      <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
        <h2>Weekly AI Chat Usage</h2>
        <p>
          Total events: <b>${totalEvents}</b> — User messages: <b>${userMessageCount}</b> — Assistant messages: <b>${assistantMessageCount}</b><br/>
          Unique users: <b>${uniqueUsers}</b>
        </p>
        <h3>Top users</h3>
        <table style="border-collapse:collapse;min-width:420px;">
          <thead>
            <tr>
              <th style="text-align:left;padding:6px 8px;border-bottom:1px solid #ddd;">#</th>
              <th style="text-align:left;padding:6px 8px;border-bottom:1px solid #ddd;">User</th>
              <th style="text-align:left;padding:6px 8px;border-bottom:1px solid #ddd;">Prompts</th>
              <th style="text-align:left;padding:6px 8px;border-bottom:1px solid #ddd;">Total events</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml || `<tr><td colspan="4" style="padding:8px;color:#666;">No usage in the last 7 days.</td></tr>`}
          </tbody>
        </table>
        <h3 style="margin-top:18px;">Recent sample prompts</h3>
        ${sampleHtml || `<div style="color:#666;">No samples available.</div>`}
      </div>
    `;

    const text = `Weekly AI Chat Usage\n\nTotal events: ${totalEvents}\nUser messages: ${userMessageCount}\nAssistant messages: ${assistantMessageCount}\nUnique users: ${uniqueUsers}\n\nTop users:\n${users
      .slice(0, 10)
      .map(
        (u, i) =>
          `${i + 1}. ${u.user} — prompts: ${u.prompts}, events: ${u.count}`,
      )
      .join("\n")}\n`;

    // Determine recipients: all admins + primary admin email
    const admins =
      await sql`SELECT email FROM auth_users WHERE role = 'admin' AND email IS NOT NULL`;
    const set = new Set([
      "glossontravis@gmail.com",
      ...admins.map((a) => (a.email || "").toLowerCase()),
    ]);
    const recipients = Array.from(set);

    const subject = `AI Chat Weekly Report (${new Date().toLocaleDateString()})`;
    const send = await sendEmail({ to: recipients, subject, html, text });

    return Response.json({
      sent: send.sent,
      reason: send.reason,
      recipients,
      summary: {
        totalEvents,
        userMessageCount,
        assistantMessageCount,
        uniqueUsers,
      },
    });
  } catch (e) {
    console.error("weekly report error", e);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
