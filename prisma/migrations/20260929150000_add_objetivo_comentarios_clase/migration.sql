-- Los dos recuadros que el formato Word del informe lleva y el modelo no tenía:
-- «Objetivo:» en el encabezado y «Comentarios» al cierre.
--
-- ADITIVA A PROPÓSITO. Dos columnas nuevas, NULL-ables y SIN DEFAULT: en
-- PostgreSQL eso es solo un cambio de catálogo, no reescribe ni una fila de
-- "Clase" y no toma un lock que bloquee lecturas. Las 12 sesiones de 2026
-- quedan con los dos campos vacíos, que es la verdad —nunca se capturaron— y
-- la exportación simplemente no imprime esos recuadros.
--
-- «Desarrollo de actividad» NO tiene columna propia: es "Clase"."descripcion",
-- que ya existe. Ver el comentario sobre `model Clase` en schema.prisma.

ALTER TABLE "Clase" ADD COLUMN "objetivo" TEXT;
ALTER TABLE "Clase" ADD COLUMN "comentarios" TEXT;
