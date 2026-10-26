// Analítica propia sin cookies ni almacenamiento en el dispositivo.
// Respeta "Do Not Track" y "Global Privacy Control".
// Uso: <script src="js/track.js" data-endpoint="https://TU-PROYECTO.supabase.co/functions/v1/track" defer></script>
// Clics: añade data-track="cta_click" (u otro evento permitido) a cualquier enlace o botón.
(function () {
  var script = document.currentScript;
  var endpoint = script && script.getAttribute("data-endpoint");
  if (!endpoint || endpoint.indexOf("TU-PROYECTO") !== -1) return; // sin configurar: no envía nada
  if (navigator.doNotTrack === "1" || navigator.globalPrivacyControl === true) return;

  var params = new URLSearchParams(location.search);
  var base = {
    path: location.pathname,
    referrer: document.referrer || null,
    utm_source: params.get("utm_source"),
    utm_medium: params.get("utm_medium"),
    utm_campaign: params.get("utm_campaign"),
    lang: (document.documentElement.lang || navigator.language || "").slice(0, 8)
  };

  function send(event, meta) {
    var payload = JSON.stringify(Object.assign({ event: event, meta: meta || {} }, base));
    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon(endpoint, new Blob([payload], { type: "text/plain;charset=UTF-8" }));
      } else {
        fetch(endpoint, { method: "POST", body: payload, headers: { "Content-Type": "text/plain;charset=UTF-8" }, keepalive: true });
      }
    } catch (e) { /* la analítica nunca rompe la página */ }
  }

  window.tbTrack = send;
  send("pageview");

  document.addEventListener("click", function (e) {
    var el = e.target.closest && e.target.closest("[data-track]");
    if (el) send(el.getAttribute("data-track"), { label: (el.textContent || "").trim().slice(0, 60) });
  });
})();
