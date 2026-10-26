// Edge Function de Supabase: recibe eventos de Stripe y sincroniza la tabla subscriptions.
// Desplegar con: supabase functions deploy stripe-webhook --no-verify-jwt
// Variables: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import Stripe from "https://esm.sh/stripe@14?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-06-20",
  httpClient: Stripe.createFetchHttpClient(),
});
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

Deno.serve(async (req) => {
  const signature = req.headers.get("stripe-signature");
  if (!signature) return new Response("Missing signature", { status: 400 });

  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      Deno.env.get("STRIPE_WEBHOOK_SECRET")!,
      undefined,
      Stripe.createSubtleCryptoProvider()
    );
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  if (
    event.type === "customer.subscription.created" ||
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted"
  ) {
    const sub = event.data.object as Stripe.Subscription;
    const userId = sub.metadata?.supabase_user_id;
    if (!userId) return new Response("No user id in metadata", { status: 422 });

    const periodEnd = sub.items.data[0]?.current_period_end;
    const { error } = await supabase.from("subscriptions").upsert(
      {
        user_id: userId,
        stripe_customer_id: String(sub.customer),
        stripe_subscription_id: sub.id,
        status: sub.status,
        current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "stripe_subscription_id" }
    );
    if (error) return new Response("DB error", { status: 500 });
  }

  // Venta de la guía (Payment Link / Checkout en modo pago único).
  if (event.type === "checkout.session.completed") {
    const s = event.data.object as Stripe.Checkout.Session;
    if (s.mode === "payment" && s.payment_status === "paid") {
      // El kit CCSE se detecta por importe total distinto al de la guía sola.
      const guidePrice = Number(Deno.env.get("GUIDE_PRICE_CENTS") ?? "999");
      const { error } = await supabase.from("orders").upsert(
        {
          stripe_session_id: s.id,
          stripe_payment_intent: typeof s.payment_intent === "string" ? s.payment_intent : null,
          email: s.customer_details?.email ?? null,
          amount_cents: s.amount_total ?? 0,
          currency: s.currency ?? "eur",
          includes_kit: (s.amount_total ?? 0) > guidePrice,
          // La landing pasa la fuente de tráfico en client_reference_id.
          utm_source: s.client_reference_id ?? null,
          status: "paid",
        },
        { onConflict: "stripe_session_id" }
      );
      if (error) return new Response("DB error", { status: 500 });
    }
  }

  // Devolución (garantía de 14 días).
  if (event.type === "charge.refunded") {
    const c = event.data.object as Stripe.Charge;
    if (typeof c.payment_intent === "string") {
      const { error } = await supabase.from("orders")
        .update({ status: "refunded" })
        .eq("stripe_payment_intent", c.payment_intent);
      if (error) return new Response("DB error", { status: 500 });
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
