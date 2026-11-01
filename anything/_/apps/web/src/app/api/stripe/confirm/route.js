import { auth } from "@/auth";
import sql from "@/app/api/utils/sql";
import { fulfillCheckout, validateCheckout } from "./fulfillment.js";

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

    const validated = validateCheckout(checkout, {
      expectedSessionId: sessionId,
      expectedUserId: session.user.id,
    });
    if (!validated.ok && validated.code === "ownership") {
      return Response.json(
        { error: "Checkout session does not belong to this user" },
        { status: 403 },
      );
    }
    if (!validated.ok) {
      return Response.json(
        { error: "Invalid Checkout entitlement metadata" },
        { status: 400 },
      );
    }
    if (!validated.paid) {
      return Response.json({
        ok: true,
        applied: false,
        status: validated.status,
        payment_status: validated.paymentStatus,
        message: "Checkout payment not complete yet",
      });
    }

    const fulfillment = await fulfillCheckout(sql, validated, "confirmation");
    if (!fulfillment.ownerMatches) {
      return Response.json(
        { error: "Checkout session does not belong to this user" },
        { status: 403 },
      );
    }
    return Response.json({
      ok: true,
      applied: fulfillment.applied,
      plan: validated.plan,
      credits: validated.credits,
    });
  } catch (error) {
    console.error("Error confirming Stripe session:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
