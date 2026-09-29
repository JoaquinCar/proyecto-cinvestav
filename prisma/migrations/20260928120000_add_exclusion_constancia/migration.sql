-- Exclusión de constancia: quién NO recibe el documento, por qué, quién lo
-- decidió y cuándo.
--
-- Cambia la política: hasta ahora la constancia la recibía solo quien
-- alcanzaba `Edicion.minAsistencias`; ahora le toca a TODO inscrito salvo
-- excepción explícita de un ADMIN.
--
-- Migración ADITIVA: no reescribe ni una fila existente.
--   · "constanciaExcluida" es BOOLEAN NOT NULL DEFAULT false. Postgres 11+
--     guarda ese valor por defecto en el catálogo y NO reescribe la tabla:
--     las inscripciones ya cargadas pasan a leerse como `false`, es decir,
--     CON derecho a constancia, que es justo el resultado deseado. Por eso no
--     hace falta backfill.
--   · Las otras tres columnas van sin NOT NULL y sin DEFAULT: quedan en NULL,
--     que significa exactamente "nadie ha excluido a este niño".
--   · La llave foránea se añade sobre una columna que es NULL en todas las
--     filas, así que su validación no puede fallar.
--   · ON DELETE RESTRICT es deliberado: con SET NULL bastaría con borrar al
--     usuario para que una exclusión se quedara sin autor.
--   · Los dos índices se crean vacíos sobre columnas nuevas.
--
-- Se aplica en producción con `prisma migrate deploy` sin migrar ni un dato.

-- AlterTable
ALTER TABLE "Inscripcion" ADD COLUMN     "constanciaExcluida" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "constanciaExcluidaAt" TIMESTAMP(3),
ADD COLUMN     "constanciaExcluidaPorId" TEXT,
ADD COLUMN     "constanciaMotivoExclusion" TEXT;

-- CreateIndex
CREATE INDEX "Inscripcion_edicionId_constanciaExcluida_idx" ON "Inscripcion"("edicionId", "constanciaExcluida");

-- CreateIndex
CREATE INDEX "Inscripcion_constanciaExcluidaPorId_idx" ON "Inscripcion"("constanciaExcluidaPorId");

-- AddForeignKey
ALTER TABLE "Inscripcion" ADD CONSTRAINT "Inscripcion_constanciaExcluidaPorId_fkey" FOREIGN KEY ("constanciaExcluidaPorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
