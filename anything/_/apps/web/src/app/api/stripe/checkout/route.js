import { auth } from "@/auth";
import sql from "@/app/api/utils/sql";

// Replace Stripe SDK (require) with direct REST API calls using fetch and form-encoding

const PLANS = {
  starter: {
    price: 4900,
    credits: 10,
    name: "Starter Plan",
    interval: "month",
  },
  pro: { price: 9900, credits: 50, name: "Pro Plan", interval: "month" },
  agency: {
    price: 24900,
    credits: 200,
    name: "Agency Plan",
    interval: "month",
  },
  lifetime: {
    price: 99900,
    credits: 200,
    name: "Lifetime Agency",
    interval: null,
  },
};

async function stripeCreateCustomer({ email, userId }) {
  const body = new URLSearchParams();
  body.set("email", email);
  body.set("metadata[user_id]", String(userId));

  const res = await fetch("https://api.stripe.com/v1/customers", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Stripe create customer failed: ${res.status} ${text}`);
  }
  return res.json();
}

async function stripeCreateCheckoutSession({
  customerId,
  planConfig,
  planId,
  userId,
}) {
  const body = new URLSearchParams();
  body.set("customer", customerId);
  body.set("mode", planConfig.interval ? "subscription" : "payment");

  // Include the Stripe checkout session id in the return URL so we can confirm
  // upgrades even if webhooks aren't configured.
  body.set(
    "success_url",
    `${process.env.APP_URL}/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,
  );
  body.set("cancel_url", `${process.env.APP_URL}/billing?canceled=true`);
  // line_items[0]
  body.set("line_items[0][price_data][currency]", "usd");
  body.set("line_items[0][price_data][product_data][name]", planConfig.name);
  body.set(
    "line_items[0][price_data][product_data][description]",
    `${planConfig.credits} investigations per ${planConfig.interval || "lifetime"}`,
  );
  body.set("line_items[0][price_data][unit_amount]", String(planConfig.price));
  if (planConfig.interval) {
    body.set(
      "line_items[0][price_data][recurring][interval]",
      planConfig.interval,
    );
  }
  body.set("line_items[0][quantity]", "1");

  // metadata
  body.set("metadata[user_id]", String(userId));
  body.set("metadata[plan]", planId);
  body.set("metadata[credits]", String(planConfig.credits));

  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Stripe checkout session failed: ${res.status} ${text}`);
  }
  return res.json();
}

export async function POST(request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { plan } = await request.json();
    if (!PLANS[plan]) {
      return Response.json({ error: "Invalid plan" }, { status: 400 });
    }
    const planConfig = PLANS[plan];

    // Get or create Stripe customer
    const userRows = await sql`
      SELECT stripe_customer_id, email 
      FROM auth_users 
      WHERE id = ${session.user.id}
    `;
    if (!userRows?.length) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }
    let customerId = userRows[0].stripe_customer_id;
    if (!customerId) {
      const customer = await stripeCreateCustomer({
        email: userRows[0].email,
        userId: session.user.id,
      });
      customerId = customer.id;
      await sql`
        UPDATE auth_users SET stripe_customer_id = ${customerId} WHERE id = ${session.user.id}
      `;
    }

    const checkout = await stripeCreateCheckoutSession({
      customerId,
      planConfig,
      planId: plan,
      userId: session.user.id,
    });

    await sql`
      INSERT INTO logs (log_type, message, metadata_json)
      VALUES ('checkout_created', 'Stripe checkout session created', ${JSON.stringify(
        {
          user_id: session.user.id,
          plan,
          session_id: checkout.id,
        },
      )})
    `;

    return Response.json({ url: checkout.url });
  } catch (error) {
    console.error("Error creating checkout session:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
