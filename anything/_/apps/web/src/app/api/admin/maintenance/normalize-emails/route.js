import { auth } from "@/auth";
import sql from "@/app/api/utils/sql";

const ADMIN_EMAIL = "glossontravis@gmail.com";

export async function POST() {
  try {
    const session = await auth();
    const email = (session?.user?.email || "").toLowerCase();
    if (!email || (email !== ADMIN_EMAIL && session?.user?.role !== "admin")) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    // Normalize emails to lowercase to make credential lookups consistent
    const result = await sql(
      "UPDATE auth_users SET email = LOWER(email) WHERE email IS NOT NULL AND email <> LOWER(email) RETURNING id, email",
    );

    return Response.json({ updated: result.length });
  } catch (err) {
    console.error("normalize-emails failed", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
