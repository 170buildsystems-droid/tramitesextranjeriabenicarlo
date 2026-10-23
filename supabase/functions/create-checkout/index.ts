// Edge Function: crea una sesión de Stripe Checkout para la suscripción de 5 €/mes.
// Desplegar: supabase functions deploy create-checkout
// Variables: STRIPE_SECRET_KEY, STRIPE_PRICE_ID, SITE_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import Stripe from "https://esm.sh/stripe@14?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": Deno.env.get("SITE_URL") ?? "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-06-20",
  httpClient: Stripe.createFetchHttpClient(),
});

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  // Identificar al usuario a partir de su JWT. Nunca confiar en un user_id enviado por el cliente.
  const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData.user) return json({ error: "unauthorized" }, 401);
  const user = userData.user;

  // Si ya tiene suscripción activa, no crear otra.
  const { data: existing } = await admin
    .from("subscriptions")
    .select("status,current_period_end")
    .eq("user_id", user.id)
    .in("status", ["active", "trialing"])
    .maybeSingle();
  if (existing) return json({ alreadyPremium: true });

  const site = Deno.env.get("SITE_URL")!;
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: Deno.env.get("STRIPE_PRICE_ID")!, quantity: 1 }],
    customer_email: user.email,
    client_reference_id: user.id,
    // Este metadata es lo que el webhook usa para vincular la suscripción con el usuario.
    subscription_data: { metadata: { supabase_user_id: user.id } },
    success_url: `${site}/cuenta/?pago=ok`,
    cancel_url: `${site}/cuenta/?pago=cancelado`,
    locale: "es",
  });

  return json({ url: session.url });
});
