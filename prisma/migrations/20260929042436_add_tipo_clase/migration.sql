-- Tres tipos de actividad donde antes solo había uno.
--
-- Esta migración es ADITIVA a propósito: no toca ni una fila. Se puede aplicar
-- con `prisma migrate deploy` sobre la base de producción —que tiene las 12
-- sesiones de la edición 2026— sin backfill y sin ventana de mantenimiento.
--
--   1. CREATE TYPE — crea el enum. No afecta a ninguna tabla existente.
--   2. ADD COLUMN ... NOT NULL DEFAULT 'PASAPORTE' — en PostgreSQL 11+ un
--      DEFAULT no volátil se guarda en el catálogo y la tabla NO se reescribe:
--      las 12 filas existentes pasan a leerse como PASAPORTE sin un solo UPDATE.
--      Que el default sea PASAPORTE es la decisión: lo que ya existía son
--      charlas del programa, así que quedan correctas solas.
--   3. DROP NOT NULL sobre "investigador" — relajar una restricción es también
--      un cambio de catálogo: no revalida ni reescribe nada, y ninguna fila
--      existente se queda en NULL. Hace falta porque una clausura o un día del
--      niño no los imparte ningún investigador.
--   4. CREATE INDEX — las pantallas piden siempre "las X de esta edición",
--      filtrando por tipo. Sobre una tabla de 12 filas es instantáneo.
--
-- Nada de esto es destructivo ni reversible-con-pérdida: revertir sería
-- DROP COLUMN "tipo" y volver a poner el NOT NULL.

-- CreateEnum
CREATE TYPE "TipoClase" AS ENUM ('PASAPORTE', 'LECTURA', 'EVENTO');

-- AlterTable
ALTER TABLE "Clase" ADD COLUMN     "tipo" "TipoClase" NOT NULL DEFAULT 'PASAPORTE',
ALTER COLUMN "investigador" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Clase_edicionId_tipo_idx" ON "Clase"("edicionId", "tipo");
