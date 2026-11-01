// This map must stay aligned with checkout/route.js.
export const PLAN_CREDITS = Object.freeze({
  starter: 10,
  pro: 50,
  agency: 200,
  lifetime: 200,
});

function customerIdFrom(checkout) {
  return typeof checkout?.customer === "string"
    ? checkout.customer
    : checkout?.customer?.id;
}

function subscriptionIdFrom(checkout) {
  return typeof checkout?.subscription === "string"
    ? checkout.subscription
    : checkout?.subscription?.id || null;
}

export function validateCheckout(
  checkout,
  { expectedSessionId, expectedUserId } = {},
) {
  const sessionId = checkout?.id;
  const customerId = customerIdFrom(checkout);
  const userId = checkout?.metadata?.user_id;
  const subscriptionId = subscriptionIdFrom(checkout);
  const plan = checkout?.metadata?.plan;
  const credits = Number(checkout?.metadata?.credits);

  if (
    !sessionId ||
    !userId ||
    typeof customerId !== "string" ||
    !customerId ||
    (expectedSessionId && sessionId !== expectedSessionId) ||
    (expectedUserId && String(userId) !== String(expectedUserId))
  ) {
    return { ok: false, code: "ownership" };
  }

  if (
    !Object.hasOwn(PLAN_CREDITS, plan) ||
    !Number.isSafeInteger(credits) ||
    credits !== PLAN_CREDITS[plan] ||
    checkout.mode !== (plan === "lifetime" ? "payment" : "subscription") ||
    (plan !== "lifetime" && !subscriptionId)
  ) {
    return { ok: false, code: "entitlement" };
  }

  if (checkout.status !== "complete" || checkout.payment_status !== "paid") {
    return {
      ok: true,
      paid: false,
      sessionId,
      userId: String(userId),
      customerId,
      plan,
      credits,
      subscriptionId,
      status: checkout.status || null,
      paymentStatus: checkout.payment_status || null,
    };
  }

  return {
    ok: true,
    paid: true,
    sessionId,
    userId: String(userId),
    customerId,
    plan,
    credits,
    subscriptionId,
  };
}

// The session-id primary key is shared by browser confirmation and webhook
// handling, so either path can win but only one can grant an entitlement.
export async function fulfillCheckout(sql, checkout, source) {
  const [result] = await sql`
    WITH eligible AS MATERIALIZED (
      SELECT id FROM auth_users
      WHERE id::text = ${checkout.userId}
        AND stripe_customer_id = ${checkout.customerId}
      FOR UPDATE
    ), claimed AS (
      INSERT INTO stripe_checkout_fulfillments (session_id, user_id, customer_id)
      SELECT ${checkout.sessionId}, id::text, ${checkout.customerId} FROM eligible
      ON CONFLICT (session_id) DO NOTHING
      RETURNING user_id
    ), updated AS (
      UPDATE auth_users AS users
      SET subscription_plan = ${checkout.plan},
          monthly_remaining = ${checkout.credits},
          stripe_subscription_id = ${checkout.subscriptionId}
      FROM claimed
      WHERE users.id::text = claimed.user_id
      RETURNING users.id
    ), logged AS (
      INSERT INTO logs (log_type, message, metadata_json)
      SELECT 'stripe_checkout_fulfilled', 'Applied Stripe Checkout entitlement',
        ${JSON.stringify({
          user_id: checkout.userId,
          plan: checkout.plan,
          credits: checkout.credits,
          session_id: checkout.sessionId,
          customer_id: checkout.customerId,
          subscription_id: checkout.subscriptionId,
          source,
        })}
      FROM updated
      RETURNING log_type
    )
    SELECT EXISTS (SELECT 1 FROM eligible) AS owner_matches,
           EXISTS (SELECT 1 FROM updated) AS applied
  `;
  return {
    ownerMatches: Boolean(result?.owner_matches),
    applied: Boolean(result?.applied),
  };
}
