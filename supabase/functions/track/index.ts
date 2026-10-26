// Edge Function: recibe eventos de analítica sin cookies.
// Desplegar: supabase functions deploy track --no-verify-jwt
// Variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, TRACK_SALT (cadena aleatoria larga), SITE_URL
//
// No guarda IP ni user-agent. Calcula un hash diario: sha256(TRACK_SALT + fecha + IP + UA).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED = new Set(["pageview", "cta_click", "bump_toggle", "checkout_start", "app_open", "signup"]);
const site = Deno.env.get("SITE_URL") ?? "*";
const cors = {
  "Access-Control-Allow-Origin": site,
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

async function sha256(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

const clip = (v: unknown, n = 120) => (typeof v === "string" ? v.slice(0, n) : null);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return new Response("method", { status: 405, headers: cors });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return new Response("bad json", { status: 400, headers: cors }); }

  const event = String(body.event ?? "");
  if (!ALLOWED.has(event)) return new Response("bad event", { status: 400, headers: cors });

  const ua = req.headers.get("user-agent") ?? "";
  if (/bot|crawl|spider|slurp|headless|lighthouse/i.test(ua)) return new Response(null, { status: 204, headers: cors });

  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim();
  const day = new Date().toISOString().slice(0, 10);
  const visitor_hash = await sha256(`${Deno.env.get("TRACK_SALT")}|${day}|${ip}|${ua}`);

  const device = /tablet|ipad/i.test(ua) ? "tablet" : /mobi|android|iphone/i.test(ua) ? "mobile" : "desktop";

  let referrer_host: string | null = null;
  try {
    const r = clip(body.referrer, 300);
    if (r) {
      const h = new URL(r).hostname.replace(/^www\./, "");
      const own = new URL(site === "*" ? "https://x.invalid" : site).hostname.replace(/^www\./, "");
      referrer_host = h === own ? null : h;
    }
  } catch { /* referrer inválido: se ignora */ }

  const { error } = await admin.from("events").insert({
    event,
    path: clip(body.path, 200) ?? "/",
    referrer_host,
    utm_source: clip(body.utm_source, 60),
    utm_medium: clip(body.utm_medium, 60),
    utm_campaign: clip(body.utm_campaign, 80),
    lang: clip(body.lang, 8),
    device,
    visitor_hash,
    meta: typeof body.meta === "object" && body.meta !== null ? body.meta : {},
  });

  return new Response(null, { status: error ? 500 : 204, headers: cors });
});
