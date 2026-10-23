# tramitesextranjeriabenicarlo.com

Proyecto en fase 1. Estructura y estado:

| Ruta | Estado |
|---|---|
| `index.html` | Landing pública con hreflang, CTA de 5 €/mes y FAQ |
| `tramites/empadronamiento/index.html` | Guía con HowTo y FAQPage. Pendiente de verificación oficial |
| `robots.txt`, `sitemap.xml` | Listos. Bloquea `/app/` y `/api/` |
| `sql/001_schema.sql` | Esquema Supabase con RLS y `is_premium()` |
| `supabase/functions/stripe-webhook/` | Edge Function: sincroniza suscripciones de Stripe |
| `supabase/functions/create-checkout/` | Edge Function: crea la sesión de pago |
| `cuenta/` | Entrada, pago y guía (solo con suscripción activa) |
| `tramites/nie/index.html` | **Borrador** (`noindex`). Datos marcados `[VERIFICAR]` |
| `tramites/tarjeta-sanitaria/index.html` | **Borrador** (`noindex`). Datos marcados `[VERIFICAR]` |
| `tramites/escolarizacion/index.html` | **Borrador** (`noindex`). Datos marcados `[VERIFICAR]` |

Los borradores no se indexan hasta quitar `noindex` tras verificar cada dato. Las búsquedas web de esta sesión no devolvieron fuentes oficiales vigentes para estos trámites.

| `tramites/imv/index.html` | **Borrador** (`noindex`). Importes y requisitos `[VERIFICAR]` |
| `tramites/empleo/index.html` | **Borrador** (`noindex`). Requisitos `[VERIFICAR]` |
| `legal/aviso-legal.html` | **Borrador** para revisión por abogado (`noindex`) |
| `legal/privacidad.html` | **Borrador** RGPD para revisión por abogado (`noindex`) |
| `brand/logo-icon.svg`, `brand/logo.svg` | Logotipo: estrella zellige, م (árabe) y ⴰⵎⴰⵣⵉⵖ (tifinagh) |
| `brand/icon-192.png`, `brand/icon-512.png` | Iconos PNG para la PWA |
| `manifest.webmanifest`, `sw.js` | PWA instalable y caché de la cáscara sin conexión |
| `app/index.html` | App con selector de idioma: es, ar, ary (darija), zgh (tamazight) |

**Logotipo:** el árabe y el tifinagh del SVG dependen de fuentes. Antes de imprimir o usar en dominio oficial, convertir el texto a trazados (en Inkscape: Trayecto > Objeto a trayecto) para que no dependa de fuentes del dispositivo. Las versiones árabe, darija y tamazight de la app son borradores sin revisar.

## Pendiente antes de publicar
1. Verificar en fuente oficial y completar los borradores de trámites (NIE, tarjeta sanitaria, escolarización, IMV, empleo). Después quitar `noindex` y actualizar la fecha de revisión.
2. Revisar aviso legal y privacidad con un abogado; completar titular, bases jurídicas y plazos de conservación.
2. Verificar requisitos, plazos y tasas de cada trámite en la fuente oficial, y actualizar `lastReviewed`.
3. Crear las versiones `/ar/` y `/ary/` con traducción revisada por hablante nativo.
4. Redactar aviso legal, privacidad y cookies. Revisar el email de contacto antes de publicarlo.
5. Configurar Stripe (producto de 5 €/mes, metadata `supabase_user_id`) y el webhook.
6. Generar audio por paso con voces disponibles en el navegador, indicando qué idiomas tienen voz.

## Zona de pago (`cuenta/`)
Flujo: registro/entrada → Stripe Checkout (5 €/mes) → webhook activa la suscripción → la guía se desbloquea.

Pasos para ponerla en marcha (requieren tu cuenta):
1. **Supabase:** crea un proyecto. Ejecuta `sql/001_schema.sql` y luego `sql/002_seed_steps.sql` en el editor SQL.
2. **Configuración pública:** copia la URL y la clave anon en `cuenta/config.js`. La clave anon es pública; la seguridad la aplican las políticas RLS.
3. **Stripe:** crea un producto con precio recurrente de 5 €/mes y copia su `price_id`.
4. **Secretos del servidor** (nunca en el repositorio), con `supabase secrets set`:
   - `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID`
   - `SITE_URL` (p. ej. `https://tudominio.com`)
   - `SUPABASE_SERVICE_ROLE_KEY` (la rellena Supabase automáticamente en las funciones)
5. **Desplegar funciones:** `supabase functions deploy create-checkout` y `supabase functions deploy stripe-webhook --no-verify-jwt`.
6. **Webhook en Stripe:** apunta a la URL de `stripe-webhook` y activa los eventos `customer.subscription.created`, `.updated` y `.deleted`.
7. **Prueba:** usa las tarjetas de prueba de Stripe en modo test antes de cobrar con dinero real.

Aún no está probado de extremo a extremo: no tengo acceso a tus cuentas de Supabase ni de Stripe.

## Fuentes
`FUENTES.md` registra cada URL oficial consultada, qué quedó confirmado y qué no. Úsalo para revisar cada `[VERIFICAR]` antes de quitar `noindex`.

## Notas
- El control premium nunca va en el cliente: se valida con RLS y `is_premium()`.
- La información de trámites es general y no tiene valor jurídico.
