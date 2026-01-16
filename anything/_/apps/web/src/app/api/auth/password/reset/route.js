import sql from "@/app/api/utils/sql";
import argon2 from "argon2";

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    let { email, token, password } = body || {};

    if (!email || !token || !password) {
      return Response.json(
        { error: "Email, token, and password are required" },
        { status: 400 },
      );
    }

    email = String(email).trim().toLowerCase();

    if (String(password).length < 8) {
      return Response.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 },
      );
    }

    // Verify token is valid and not expired
    const tokens = await sql(
      "SELECT token, identifier, expires FROM auth_verification_token WHERE identifier = $1 AND token = $2 AND expires > NOW() LIMIT 1",
      [email, token],
    );

    if (tokens.length === 0) {
      return Response.json(
        { error: "Invalid or expired token" },
        { status: 400 },
      );
    }

    // Ensure user exists
    const users = await sql(
      "SELECT id, email FROM auth_users WHERE LOWER(email) = LOWER($1) LIMIT 1",
      [email],
    );
    if (users.length === 0) {
      return Response.json({ error: "Invalid user" }, { status: 400 });
    }

    const user = users[0];

    // Hash the new password
    const hashed = await argon2.hash(password);

    // Try to update any existing credentials rows
    const updated = await sql(
      "UPDATE auth_accounts SET password = $1 WHERE \"userId\" = $2 AND provider IN ('credentials', 'credentials-signin') RETURNING id",
      [hashed, user.id],
    );

    if (updated.length === 0) {
      // If none existed, create a credentials row that matches the adapter's lookup
      await sql(
        'INSERT INTO auth_accounts ("userId", type, provider, "providerAccountId", password) VALUES ($1, $2, $3, $4, $5)',
        [user.id, "credentials", "credentials", String(user.id), hashed],
      );
    }

    // Invalidate the token
    await sql(
      "DELETE FROM auth_verification_token WHERE identifier = $1 AND token = $2",
      [email, token],
    );

    return Response.json({ ok: true });
  } catch (err) {
    console.error("Password reset error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
