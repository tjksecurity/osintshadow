import sql from "@/app/api/utils/sql";
import crypto from "crypto";
import { auth } from "@/auth";

export async function POST(request) {
  try {
    const session = await auth();
    const requesterEmail = (session?.user?.email || "").toLowerCase();
    const isAdminRequester =
      requesterEmail === "glossontravis@gmail.com" ||
      session?.user?.role === "admin";

    const body = await request.json().catch(() => ({}));
    const emailRaw = body?.email;

    if (!emailRaw || typeof emailRaw !== "string") {
      return Response.json({ error: "Email is required" }, { status: 400 });
    }

    const email = emailRaw.trim().toLowerCase();

    // Find user by email (case-insensitive)
    const users = await sql(
      "SELECT id, email FROM auth_users WHERE LOWER(email) = LOWER($1) LIMIT 1",
      [email],
    );

    // Always respond with success to avoid account enumeration
    // But only create a token if the user exists
    if (users.length === 0) {
      return Response.json({ ok: true });
    }

    const user = users[0];

    // Clean up any prior tokens for this identifier
    await sql("DELETE FROM auth_verification_token WHERE identifier = $1", [
      email,
    ]);

    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await sql(
      "INSERT INTO auth_verification_token (identifier, token, expires) VALUES ($1, $2, $3)",
      [email, token, expires],
    );

    // Derive a base URL for absolute links
    const hdrs = request.headers;
    const protoHeader =
      hdrs.get("x-forwarded-proto") || hdrs.get("x-forwarded-protocol");
    const hostHeader = hdrs.get("x-forwarded-host") || hdrs.get("host");
    const derivedFromHeaders =
      hostHeader &&
      (protoHeader
        ? `${protoHeader}://${hostHeader}`
        : `https://${hostHeader}`);
    const derivedFromUrl = (() => {
      try {
        const u = new URL(request.url);
        return u.origin;
      } catch {
        return "";
      }
    })();

    const baseUrl =
      process.env.APP_URL || derivedFromHeaders || derivedFromUrl || "";
    const resetUrl = `${baseUrl}/account/password/reset?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;

    // Prepare response payload; include resetUrl so password can be reset even without email provider
    const payload = { ok: true, resetUrl };

    // If email provider env is configured, attempt to send the email via Resend HTTP API.
    // This avoids adding new packages and works in all environments.
    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    const EMAIL_FROM = process.env.EMAIL_FROM; // e.g. "ShadowTrace <no-reply@yourdomain.com>"

    if (RESEND_API_KEY && EMAIL_FROM) {
      try {
        const subject = "Reset your ShadowTrace password";
        const text = `We received a request to reset your password. If this was you, open this link:\n\n${resetUrl}\n\nIf you did not request a password reset, you can ignore this email.`;
        const html = `
          <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color: #0f172a;">
            <h2>Reset your ShadowTrace password</h2>
            <p>We received a request to reset your password. If this was you, click the button below.</p>
            <p style="margin: 24px 0;">
              <a href="${resetUrl}" style="background: #0ea5e9; color: white; padding: 10px 16px; border-radius: 8px; text-decoration: none;">Reset Password</a>
            </p>
            <p>Or copy and paste this link into your browser:</p>
            <p><a href="${resetUrl}">${resetUrl}</a></p>
            <p style="color:#64748b">If you didn't request this, you can safely ignore this email.</p>
          </div>`;

        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: EMAIL_FROM,
            to: email,
            subject,
            text,
            html,
          }),
        });

        if (!res.ok) {
          const errTxt = await res.text().catch(() => "");
          console.error(
            "Resend email failed:",
            res.status,
            res.statusText,
            errTxt,
          );
          // Do not fail the request; the UI can still use resetUrl
          return Response.json({ ...payload, emailSent: false });
        }

        return Response.json({ ...payload, emailSent: true });
      } catch (e) {
        console.error("Resend email error:", e);
        return Response.json({ ...payload, emailSent: false });
      }
    }

    // If no email provider configured, still return resetUrl for immediate use
    return Response.json(payload);
  } catch (err) {
    console.error("Password forgot error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
