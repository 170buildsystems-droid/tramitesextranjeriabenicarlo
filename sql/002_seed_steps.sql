-- Pasos verificados en fuentes oficiales (consultadas el 23/10/2026).
-- Solo se incluyen datos confirmados en la fuente. Lo que no se pudo confirmar
-- NO se añade aquí: se completará cuando se verifique en fuente oficial.

insert into public.procedure_steps
  (procedure_slug, step_order, title_es, body_es, official_source_url, last_verified_at)
values
  ('nie', 1,
   'Tasa del NIE',
   'La tasa modelo 790 código 012 para la asignación de NIE a instancia del interesado es de 9,84 €. Se paga en bancos, cajas de ahorro o cooperativas, con el impreso generado en la sede electrónica.',
   'https://sede.policia.gob.es/portalCiudadano/_es/tramites_extranjeria_tasas.php',
   '2026-10-23'),
  ('nie', 2,
   'Documentación',
   'Formulario EX15 de solicitud de NIE y justificante de pago de la tasa 790 código 012. La lista completa según el motivo sigue pendiente de verificación.',
   'https://sede.policia.gob.es/portalCiudadano/_es/tramites_extranjeria_tramite_asignacion_nie.php',
   '2026-10-23'),
  ('nie', 3,
   'Presentación y cita',
   'La solicitud puede presentarse en la Dirección General de la Policía, en las Oficinas de Extranjería o en comisarías. La página oficial no indica si hace falta cita previa: confírmalo antes de acudir.',
   'https://sede.policia.gob.es/portalCiudadano/_es/tramites_extranjeria_tramite_asignacion_nie.php',
   '2026-10-23'),
  ('empadronamiento', 1,
   'Cita previa en el ayuntamiento',
   'El Ayuntamiento de Benicarló tiene una aplicación de cita previa para la Oficina de Atención Ciudadana, que sirve para empadronarse, renovar la residencia y comunicar cambios de domicilio o de documento. Comprueba que el servicio sigue activo.',
   'https://www.ajuntamentdebenicarlo.org/cita/',
   '2026-10-23'),
  ('tarjeta-sanitaria', 1,
   'Quién puede pedirla',
   'La vía para personas extranjeras no registradas ni autorizadas como residentes más de tres meses, sin cobertura por otro título. Se tramita en el mostrador de los centros de salud de la Conselleria de Sanidad.',
   'https://www.san.gva.es/es/web/tarjeta-sanitaria/extranjeros-no-registrados-autorizados',
   '2026-10-23');
