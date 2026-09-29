-- Orden estable de las fotos dentro de cada sesión.
--
-- La columna `orden` existía desde que se añadió ImagenClase, pero no había
-- forma de cambiarla desde la interfaz, así que TODAS las filas quedaron en el
-- valor por defecto: 0. Empatadas, el ORDER BY caía en `createdAt` y el orden
-- real era "el que salga". Ahora la exportación a Word depende de él, así que:
--
--   1. Se renumeran las filas existentes por antigüedad (createdAt, y el id
--      como desempate para que la renumeración sea determinista si dos fotos se
--      subieron en el mismo milisegundo). Esto conserva el orden que la gente ya
--      veía en pantalla: era el de subida.
--   2. Se exige unicidad de (claseId, orden). Sin el paso 1 este índice no se
--      podría crear: todas las fotos de una misma sesión valían 0.

WITH renumeradas AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "claseId"
      ORDER BY "orden" ASC, "createdAt" ASC, "id" ASC
    ) - 1 AS "nuevoOrden"
  FROM "ImagenClase"
)
UPDATE "ImagenClase" AS i
SET "orden" = r."nuevoOrden"
FROM renumeradas AS r
WHERE i."id" = r."id"
  AND i."orden" IS DISTINCT FROM r."nuevoOrden";

-- CreateIndex
CREATE UNIQUE INDEX "ImagenClase_claseId_orden_key" ON "ImagenClase"("claseId", "orden");
