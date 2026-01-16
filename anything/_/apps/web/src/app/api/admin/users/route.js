import { auth } from "@/auth";
import sql from "@/app/api/utils/sql";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) {
    return {
      ok: false,
      status: 401,
      res: Response.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  const [me] =
    await sql`SELECT email, role FROM auth_users WHERE id = ${session.user.id}`;
  const isAdmin =
    me?.role === "admin" ||
    (me?.email || "").toLowerCase() === "glossontravis@gmail.com";
  if (!isAdmin) {
    return {
      ok: false,
      status: 403,
      res: Response.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  return { ok: true, session };
}

export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.res;
  try {
    const rows =
      await sql`SELECT id, name, email, role, subscription_plan, monthly_remaining FROM auth_users ORDER BY id ASC LIMIT 200`;
    return Response.json({ users: rows });
  } catch (e) {
    console.error("admin users list error", e);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.res;
  try {
    const body = await request.json();
    const { email, role, subscription_plan, monthly_remaining } = body || {};
    if (!email) {
      return Response.json({ error: "Email is required" }, { status: 400 });
    }

    const sets = [];
    const values = [];
    let idx = 1;
    if (typeof role === "string") {
      sets.push(`role = $${idx++}`);
      values.push(role);
    }
    if (typeof subscription_plan === "string") {
      sets.push(`subscription_plan = $${idx++}`);
      values.push(subscription_plan);
    }
    if (Number.isInteger(monthly_remaining)) {
      sets.push(`monthly_remaining = $${idx++}`);
      values.push(monthly_remaining);
    }

    if (sets.length === 0) {
      return Response.json({ error: "No changes provided" }, { status: 400 });
    }

    const query = `UPDATE auth_users SET ${sets.join(", ")} WHERE lower(email) = $${idx} RETURNING id, name, email, role, subscription_plan, monthly_remaining`;
    values.push(email.toLowerCase());

    const rows = await sql(query, values);
    if (rows.length === 0) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }
    return Response.json({ user: rows[0] });
  } catch (e) {
    console.error("admin users patch error", e);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
