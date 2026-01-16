import { auth } from "@/auth";
import sql from "@/app/api/utils/sql";
import { hash, verify } from "argon2";

export async function PATCH(request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { currentPassword, newPassword } = body;

    if (!currentPassword || !newPassword) {
      return Response.json(
        { error: "Current and new password are required" },
        { status: 400 },
      );
    }

    if (newPassword.length < 8) {
      return Response.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 },
      );
    }

    // Get current password hash
    const accounts = await sql`
      SELECT password
      FROM auth_accounts
      WHERE "userId" = ${session.user.id}
      AND type = 'credentials'
      AND provider = 'credentials'
    `;

    if (accounts.length === 0 || !accounts[0].password) {
      return Response.json(
        { error: "No password set for this account" },
        { status: 400 },
      );
    }

    // Verify current password
    const isValid = await verify(accounts[0].password, currentPassword);
    if (!isValid) {
      return Response.json(
        { error: "Current password is incorrect" },
        { status: 400 },
      );
    }

    // Hash new password
    const hashedPassword = await hash(newPassword);

    // Update password
    await sql`
      UPDATE auth_accounts
      SET password = ${hashedPassword}
      WHERE "userId" = ${session.user.id}
      AND type = 'credentials'
      AND provider = 'credentials'
    `;

    return Response.json({ success: true });
  } catch (error) {
    console.error("Error changing password:", error);
    return Response.json(
      { error: "Failed to change password" },
      { status: 500 },
    );
  }
}
