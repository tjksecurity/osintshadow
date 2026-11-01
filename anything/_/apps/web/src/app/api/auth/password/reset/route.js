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

    // Preserve the inexpensive rejection path for invalid tokens. This read is
    // only a preflight: the mutation rechecks expiry and atomically claims it.
    const [preflight] = await sql(
      `SELECT EXISTS (
         SELECT 1 FROM auth_verification_token
         WHERE identifier = $1 AND token = $2 AND expires > NOW()
       ) AS token_exists,
       EXISTS (SELECT 1 FROM auth_users WHERE LOWER(email) = LOWER($1)) AS user_exists`,
      [email, token],
    );
    if (!preflight?.token_exists) {
      return Response.json({ error: "Invalid or expired token" }, { status: 400 });
    }
    if (!preflight.user_exists) {
      return Response.json({ error: "Invalid user" }, { status: 400 });
    }

    // Hash before the atomic database mutation. A hash failure cannot consume
    // a token, and validity/expiry are checked again at mutation time.
    const hashed = await argon2.hash(password);
    const [result] = await sql(
      `WITH candidate AS MATERIALIZED (
         SELECT token FROM auth_verification_token
         WHERE identifier = $1 AND token = $2 AND expires > NOW()
       ), owner AS MATERIALIZED (
         SELECT id FROM auth_users WHERE LOWER(email) = LOWER($1) LIMIT 1
       ), claimed AS (
         DELETE FROM auth_verification_token
         WHERE identifier = $1 AND token = $2 AND expires > NOW()
           AND EXISTS (SELECT 1 FROM owner)
         RETURNING token
       ), updated AS (
         UPDATE auth_accounts AS accounts SET password = $3
         FROM owner
         WHERE accounts."userId" = owner.id
           AND accounts.provider IN ('credentials', 'credentials-signin')
           AND EXISTS (SELECT 1 FROM claimed)
         RETURNING accounts.id
       ), inserted AS (
         INSERT INTO auth_accounts ("userId", type, provider, "providerAccountId", password)
         SELECT owner.id, 'credentials', 'credentials', owner.id::text, $3
         FROM owner
         WHERE EXISTS (SELECT 1 FROM claimed)
           AND NOT EXISTS (SELECT 1 FROM updated)
         RETURNING id
       )
       SELECT EXISTS (SELECT 1 FROM candidate) AS token_exists,
              EXISTS (SELECT 1 FROM owner) AS user_exists,
              EXISTS (SELECT 1 FROM claimed) AS token_claimed,
              (EXISTS (SELECT 1 FROM updated) OR EXISTS (SELECT 1 FROM inserted)) AS password_updated`,
      [email, token, hashed],
    );

    // DELETE is the token claim. Concurrent retries cannot both claim the same
    // row, and any password-write failure rolls the entire statement back.
    if (!result?.token_exists || !result?.token_claimed) {
      if (result?.token_exists && !result?.user_exists) {
        return Response.json({ error: "Invalid user" }, { status: 400 });
      }
      return Response.json({ error: "Invalid or expired token" }, { status: 400 });
    }
    if (!result.password_updated) throw new Error("Password reset did not update credentials.");

    return Response.json({ ok: true });
  } catch (err) {
    console.error("Password reset error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
