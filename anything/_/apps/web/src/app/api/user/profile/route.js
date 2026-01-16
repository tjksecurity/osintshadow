import { auth } from "@/auth";
import sql from "@/app/api/utils/sql";

export async function PATCH(request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name } = body;

    if (!name || typeof name !== "string") {
      return Response.json({ error: "Name is required" }, { status: 400 });
    }

    // Update user name
    await sql`
      UPDATE auth_users
      SET name = ${name}
      WHERE id = ${session.user.id}
    `;

    return Response.json({ success: true, name });
  } catch (error) {
    console.error("Error updating profile:", error);
    return Response.json(
      { error: "Failed to update profile" },
      { status: 500 },
    );
  }
}
