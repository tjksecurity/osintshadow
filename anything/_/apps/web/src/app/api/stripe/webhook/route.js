import sql from "@/app/api/utils/sql";
import crypto from "crypto";
import { fulfillCheckout, validateCheckout } from "./fulfillment.js";

// Verify Stripe webhook signature without Stripe SDK
const SIGNATURE_TOLERANCE_SECONDS = 300;

function verifyStripeSignature(rawBody, sigHeader, secret) {
  if (!sigHeader || !secret) return false;
  // Header format: t=timestamp,v1=signature[,v0=old]
  const parts = sigHeader.split(",").map((part) => {
    const index = part.indexOf("=");
    return index < 1 ? [] : [part.slice(0, index), part.slice(index + 1)];
  });
  const timestamp = parts.find(([key]) => key === "t")?.[1];
  const signatures = parts
    .filter(([key, value]) => key === "v1" && /^[0-9a-f]{64}$/i.test(value))
    .map(([, value]) => value);
  const timestampSeconds = Number(timestamp);
  if (
    !Number.isSafeInteger(timestampSeconds) ||
    !signatures.length ||
    Math.abs(Math.floor(Date.now() / 1000) - timestampSeconds) >
      SIGNATURE_TOLERANCE_SECONDS
  ) {
    return false;
  }
  const payload = `${timestamp}.${rawBody}`;
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(payload, "utf8");
  const digest = hmac.digest("hex");
  const expected = Buffer.from(digest, "hex");
  return signatures.some((signature) => {
    const received = Buffer.from(signature, "hex");
    return (
      received.length === expected.length &&
      crypto.timingSafeEqual(expected, received)
    );
  });
}

async function stripeGet(path) {
  const res = await fetch(`https://api.stripe.com${path}`, {
    headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Stripe GET ${path} failed: ${res.status} ${text}`);
  }
  return res.json();
}

export async function POST(request) {
  try {
    const raw = await request.text();
    const sig = request.headers.get("stripe-signature");

    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!verifyStripeSignature(raw, sig, secret)) {
      return Response.json({ error: "Invalid signature" }, { status: 400 });
    }

    const event = JSON.parse(raw);

    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object, event.id);
        break;
      case "invoice.payment_succeeded":
        await handlePaymentSucceeded(event.data.object);
        break;
      case "customer.subscription.created":
        await handleSubscriptionCreated(event.data.object);
        break;
      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event.data.object);
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object);
        break;
      default:
        // ignore
        break;
    }

    await sql`
      INSERT INTO logs (log_type, message, metadata_json)
      VALUES ('stripe_webhook', 'Stripe webhook received', ${JSON.stringify({
        event_type: event.type,
        event_id: event.id,
      })})
    `;

    return Response.json({ received: true });
  } catch (error) {
    console.error("Error processing webhook:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

async function handleCheckoutCompleted(session, eventId) {
  const validated = validateCheckout(session);
  if (!validated.ok || !validated.paid) return;

  // This uses the same session-id claim as the browser confirm endpoint.
  // Whichever signed delivery arrives first may fulfill the session once.
  await fulfillCheckout(sql, validated, { type: "webhook", event_id: eventId });
}

async function handlePaymentSucceeded(invoice) {
  if (!invoice.subscription) return;
  const subscription = await stripeGet(
    `/v1/subscriptions/${invoice.subscription}`,
  );
  // A delayed payment event can arrive after cancellation. Do not restore
  // credits unless Stripe still reports the subscription as active.
  if (subscription?.status !== "active") return;

  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer?.id;
  if (!customerId) return;

  const customer = await stripeGet(`/v1/customers/${customerId}`);

  const plan = { starter: 10, pro: 50, agency: 200 };
  // The checkout route does not currently propagate plan metadata to Stripe's
  // subscription object. Keep the existing local-plan entitlement source.
  // Never bind a legacy null identity from an invoice: an older active
  // subscription on the same customer could otherwise claim the account.
  const user = await sql`
    SELECT id, subscription_plan FROM auth_users
    WHERE stripe_customer_id = ${customer.id}
      AND stripe_subscription_id = ${subscription.id}
    FOR UPDATE
  `;
  if (!user.length) return;
  const userId = user[0].id;
  const currentPlan = user[0].subscription_plan;

  const credits = plan[currentPlan] || 0;
  if (!credits) return;

  await sql`
    UPDATE auth_users
    SET monthly_remaining = ${credits}, stripe_subscription_id = ${subscription.id}
    WHERE id = ${userId}
      AND stripe_customer_id = ${customer.id}
      AND stripe_subscription_id = ${subscription.id}
  `;

  await sql`
    INSERT INTO logs (log_type, message, metadata_json)
    VALUES ('payment_succeeded', 'Monthly payment succeeded, credits added', ${JSON.stringify(
      {
        user_id: userId,
        plan: currentPlan,
        credits_added: credits,
        invoice_id: invoice.id,
      },
    )})
  `;
}

async function handleSubscriptionCreated(subscription) {
  const customer = await stripeGet(`/v1/customers/${subscription.customer}`);
  await sql`
    INSERT INTO logs (log_type, message, metadata_json)
    VALUES ('subscription_created', 'Subscription created', ${JSON.stringify({
      customer_id: customer.id,
      subscription_id: subscription.id,
    })})
  `;
}

async function handleSubscriptionUpdated(subscription) {
  const customer = await stripeGet(`/v1/customers/${subscription.customer}`);
  await sql`
    INSERT INTO logs (log_type, message, metadata_json)
    VALUES ('subscription_updated', 'Subscription updated', ${JSON.stringify({
      customer_id: customer.id,
      subscription_id: subscription.id,
      status: subscription.status,
    })})
  `;
}

async function handleSubscriptionDeleted(subscription) {
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer?.id;
  if (!subscription?.id || !customerId) return;

  // Do not let an old cancellation clear a newer subscription on the same
  // customer. Legacy null identities are intentionally not guessed here.
  await sql`
    UPDATE auth_users
    SET subscription_plan = NULL,
        monthly_remaining = 0,
        stripe_subscription_id = NULL
    WHERE stripe_customer_id = ${customerId}
      AND stripe_subscription_id = ${subscription.id}
  `;

  await sql`
    INSERT INTO logs (log_type, message, metadata_json)
    VALUES ('subscription_cancelled', 'Subscription cancelled', ${JSON.stringify(
      {
        customer_id: customerId,
        subscription_id: subscription.id,
      },
    )})
  `;
}
