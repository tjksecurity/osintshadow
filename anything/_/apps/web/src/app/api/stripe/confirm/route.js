import { auth } from "@/auth";
import sql from "@/app/api/utils/sql";

async function stripeGet(path) {
  const res = await fetch(`https://api.stripe.com${path}`, {
    headers: {
      Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Stripe GET ${path} failed: ${res.status} ${text}`);
  }
  return res.json();
}

export async function POST(request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const sessionId = body?.session_id;

    if (!sessionId || typeof sessionId !== "string") {
      return Response.json(
        { error: "session_id is required" },
        { status: 400 },
      );
    }

    // Pull the checkout session from Stripe. We rely on metadata from our checkout route.
    const checkout = await stripeGet(
      `/v1/checkout/sessions/${encodeURIComponent(sessionId)}`,
    );

    const customerId = checkout?.customer;
    const plan = checkout?.metadata?.plan || null;
    const credits = Number(checkout?.metadata?.credits || 0);

    // In most cases Stripe will redirect only after success, but we still sanity check.
    const paymentStatus = checkout?.payment_status || null; // "paid" for payments
    const status = checkout?.status || null; // "complete"

    if (!plan) {
      return Response.json(
        { error: "Checkout session is missing plan metadata" },
        { status: 400 },
      );
    }

    // If payment/subscription isn't complete, don't upgrade.
    const looksPaid = paymentStatus === "paid" || status === "complete";
    if (!looksPaid) {
      return Response.json(
        {
          ok: true,
          applied: false,
          status,
          payment_status: paymentStatus,
          message: "Checkout not complete yet",
        },
        { status: 200 },
      );
    }

    // Only allow confirming a session for the signed-in user.
    const userRows = await sql`
      SELECT id, stripe_customer_id
      FROM auth_users
      WHERE id = ${session.user.id}
      LIMIT 1
    `;

    if (!userRows.length) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    // Apply plan + credits.
    await sql`
      UPDATE auth_users
      SET subscription_plan = ${plan},
          monthly_remaining = ${credits},
          stripe_customer_id = COALESCE(stripe_customer_id, ${customerId})
      WHERE id = ${session.user.id}
    `;

    await sql`
      INSERT INTO logs (log_type, message, metadata_json)
      VALUES (
        'stripe_confirm',
        'Applied subscription plan via confirm endpoint',
        ${JSON.stringify({
          user_id: session.user.id,
          plan,
          credits,
          session_id: sessionId,
          customer_id: customerId,
        })}
      )
    `;

    return Response.json({ ok: true, applied: true, plan, credits });
  } catch (error) {
    console.error("Error confirming Stripe session:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
