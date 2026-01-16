import sql from "@/app/api/utils/sql";
import crypto from "crypto";

// Verify Stripe webhook signature without Stripe SDK
function verifyStripeSignature(rawBody, sigHeader, secret) {
  if (!sigHeader || !secret) return false;
  // Header format: t=timestamp,v1=signature[,v0=old]
  const parts = Object.fromEntries(
    sigHeader.split(",").map((p) => p.split("=")),
  );
  const t = parts.t;
  const v1 = parts.v1;
  if (!t || !v1) return false;
  const payload = `${t}.${rawBody}`;
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(payload, "utf8");
  const digest = hmac.digest("hex");
  // Constant-time compare
  const a = Buffer.from(digest, "hex");
  const b = Buffer.from(v1, "hex");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
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
        await handleCheckoutCompleted(event.data.object);
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

async function handleCheckoutCompleted(session) {
  const userId = session.metadata?.user_id;
  const plan = session.metadata?.plan;
  const credits = parseInt(session.metadata?.credits || "0", 10);

  if (!userId) return;

  if (session.mode === "payment") {
    // Lifetime plan
    await sql`
      UPDATE auth_users 
      SET subscription_plan = ${plan}, monthly_remaining = ${credits}
      WHERE id = ${userId}
    `;
  } else if (session.mode === "subscription") {
    await sql`
      UPDATE auth_users 
      SET subscription_plan = ${plan}
      WHERE id = ${userId}
    `;
  }

  await sql`
    INSERT INTO logs (log_type, message, metadata_json)
    VALUES ('checkout_completed', 'Checkout session completed', ${JSON.stringify(
      {
        user_id: userId,
        plan,
        session_id: session.id,
      },
    )})
  `;
}

async function handlePaymentSucceeded(invoice) {
  if (!invoice.subscription) return;
  const subscription = await stripeGet(
    `/v1/subscriptions/${invoice.subscription}`,
  );
  const customer = await stripeGet(`/v1/customers/${subscription.customer}`);

  const user = await sql`
    SELECT id, subscription_plan FROM auth_users WHERE stripe_customer_id = ${customer.id}
  `;
  if (!user.length) return;
  const userId = user[0].id;
  const plan = user[0].subscription_plan;

  const planCredits = { starter: 10, pro: 50, agency: 200 };
  const credits = planCredits[plan] || 0;

  await sql`
    UPDATE auth_users SET monthly_remaining = ${credits} WHERE id = ${userId}
  `;

  await sql`
    INSERT INTO logs (log_type, message, metadata_json)
    VALUES ('payment_succeeded', 'Monthly payment succeeded, credits added', ${JSON.stringify(
      {
        user_id: userId,
        plan,
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
  const customer = await stripeGet(`/v1/customers/${subscription.customer}`);
  const user =
    await sql`SELECT id FROM auth_users WHERE stripe_customer_id = ${customer.id}`;
  if (!user.length) return;

  await sql`
    UPDATE auth_users SET subscription_plan = NULL, monthly_remaining = 0 WHERE id = ${user[0].id}
  `;

  await sql`
    INSERT INTO logs (log_type, message, metadata_json)
    VALUES ('subscription_cancelled', 'Subscription cancelled', ${JSON.stringify(
      {
        user_id: user[0].id,
        customer_id: customer.id,
        subscription_id: subscription.id,
      },
    )})
  `;
}
