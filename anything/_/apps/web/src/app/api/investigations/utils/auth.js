export async function checkAuthentication(authFunc) {
  const session = await authFunc();
  if (!session?.user?.id) {
    return { authenticated: false, userId: null, email: null };
  }
  return {
    authenticated: true,
    userId: session.user.id,
    email: session.user.email || null,
  };
}

export async function checkUserCredits(sql, userId) {
  const userResult = await sql`
    SELECT id, email, role, monthly_remaining, subscription_plan 
    FROM auth_users 
    WHERE id = ${userId}
  `;

  if (userResult.length === 0) {
    return { found: false, hasCredits: false, user: null };
  }

  const user = userResult[0];
  const adminEmail = "glossontravis@gmail.com";
  const isAdmin =
    user.role === "admin" || (user.email || "").toLowerCase() === adminEmail;

  return {
    found: true,
    // Admins always have credits; others must have positive remaining
    hasCredits: isAdmin ? true : user.monthly_remaining > 0,
    user,
    isAdmin,
  };
}

export async function deductUserCredit(sql, userId) {
  await sql`
    UPDATE auth_users 
    SET monthly_remaining = monthly_remaining - 1 
    WHERE id = ${userId}
  `;
}
