import sql from "@/app/api/utils/sql";
import crypto from "node:crypto";

const success = () =>
  Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });

function resetOrigin() {
  try {
    // Only operator-controlled configuration may select the reset-link origin.
    const url = new URL(process.env.APP_URL || process.env.AUTH_URL);
    const local =
      process.env.NODE_ENV !== "production" &&
      ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (
      url.username ||
      url.password ||
      (url.protocol !== "https:" && !(local && url.protocol === "http:"))
    ) {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    if (typeof body?.email !== "string" || !body.email.trim()) {
      return Response.json(
        { error: "Email is required" },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }
    const email = body.email.trim().toLowerCase();
    const origin = resetOrigin();
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.EMAIL_FROM;
    if (!origin || !apiKey || !from) {
      console.warn("Password reset email delivery is not configured.");
      return success();
    }

    const users = await sql(
      "SELECT id, email FROM auth_users WHERE LOWER(email) = LOWER($1) LIMIT 1",
      [email],
    );
    if (users.length === 0) return success();

    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 60 * 60 * 1000);
    await sql("DELETE FROM auth_verification_token WHERE identifier = $1", [
      email,
    ]);
    await sql(
      "INSERT INTO auth_verification_token (identifier, token, expires) VALUES ($1, $2, $3)",
      [email, token, expires],
    );

    const resetUrl = new URL("/account/password/reset", origin);
    resetUrl.searchParams.set("token", token);
    resetUrl.searchParams.set("email", email);
    const link = resetUrl.href;
    const htmlLink = link.replaceAll("&", "&amp;").replaceAll('"', "&quot;");
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + apiKey,
        },
        body: JSON.stringify({
          from,
          to: email,
          subject: "Reset your ShadowTrace password",
          text:
            "We received a request to reset your password. If this was you, open this link:\n\n" +
            link +
            "\n\nIf you did not request a password reset, you can ignore this email.",
          html:
            "<p>We received a request to reset your ShadowTrace password.</p>" +
            '<p><a href="' +
            htmlLink +
            '">Reset Password</a></p>' +
            "<p>If you did not request this, you can ignore this email.</p>",
        }),
      });
      if (!response.ok) throw new Error("Email delivery failed");
    } catch {
      // Keep undelivered tokens unusable, and never log a token or provider body.
      await sql(
        "DELETE FROM auth_verification_token WHERE identifier = $1 AND token = $2",
        [email, token],
      );
      console.error("Password reset email delivery failed.");
    }

    // Known/unknown accounts and delivery outcomes have the same public response.
    // Reset tokens are delivered only to the account's email address.
    return success();
  } catch {
    console.error("Password reset request failed.");
    return success();
  }
}

