// Service worker mínimo: cachea la cáscara de la app para uso sin conexión.
// Los datos de cuenta y pagos nunca se cachean.
const CACHE = "tramites-v1";
// Rutas relativas a la ubicación de sw.js, para funcionar en subcarpetas (GitHub Pages).
const SHELL = [
  "./",
  "./app/",
  "./brand/logo-icon.svg",
  "./brand/logo.svg",
  "./manifest.webmanifest",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  // No interceptar APIs, Supabase ni Stripe.
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request)
        .then((res) => {
          if (res.ok) caches.open(CACHE).then((c) => c.put(event.request, res.clone()));
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
