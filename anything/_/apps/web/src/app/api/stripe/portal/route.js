import { auth } from "@/auth";
import sql from "@/app/api/utils/sql";

// Replace Stripe SDK with REST call to billing portal session

export async function POST(request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rows = await sql`
      SELECT stripe_customer_id 
      FROM auth_users 
      WHERE id = ${session.user.id}
    `;

    const customerId = rows?.[0]?.stripe_customer_id;
    if (!customerId) {
      return Response.json(
        { error: "No billing account found" },
        { status: 404 },
      );
    }

    const body = new URLSearchParams();
    body.set("customer", customerId);
    body.set("return_url", `${process.env.APP_URL}/billing`);

    const res = await fetch(
      "https://api.stripe.com/v1/billing_portal/sessions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
      },
    );

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Stripe portal session failed: ${res.status} ${text}`);
    }

    const portal = await res.json();
    return Response.json({ url: portal.url });
  } catch (error) {
    console.error("Error creating portal session:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
