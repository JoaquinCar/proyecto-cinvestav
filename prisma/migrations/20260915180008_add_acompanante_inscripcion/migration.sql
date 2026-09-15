-- Acompañante de una inscripción: el adulto (o grupo) con el que llega el niño.
--
-- Migración ADITIVA: no toca ninguna fila existente.
--   · CREATE TYPE / CREATE TABLE / CREATE INDEX crean objetos nuevos.
--   · ALTER TABLE "Inscripcion" ADD COLUMN "acompananteId" TEXT va sin NOT NULL
--     y sin DEFAULT, así que Postgres solo actualiza el catálogo: no reescribe
--     la tabla y las inscripciones ya cargadas quedan en NULL — que es
--     exactamente lo que significan: nadie registró acompañante.
--   · La llave foránea se añade sobre una columna que es NULL en todas las
--     filas, de modo que su validación no puede fallar.
--
-- Se aplica en producción con `prisma migrate deploy` sin migrar ni un dato.

-- CreateEnum
CREATE TYPE "Parentesco" AS ENUM ('MADRE', 'PADRE', 'ABUELA', 'ABUELO', 'TIA', 'TIO', 'TUTOR', 'GRUPO', 'INSTITUCION', 'OTRO');

-- AlterTable
ALTER TABLE "Inscripcion" ADD COLUMN     "acompananteId" TEXT;

-- CreateTable
CREATE TABLE "Acompanante" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellidos" TEXT,
    "telefono" TEXT,
    "correo" TEXT,
    "parentesco" "Parentesco" NOT NULL DEFAULT 'OTRO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Acompanante_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Acompanante_nombre_apellidos_idx" ON "Acompanante"("nombre", "apellidos");

-- CreateIndex
CREATE INDEX "Inscripcion_acompananteId_idx" ON "Inscripcion"("acompananteId");

-- AddForeignKey
ALTER TABLE "Inscripcion" ADD CONSTRAINT "Inscripcion_acompananteId_fkey" FOREIGN KEY ("acompananteId") REFERENCES "Acompanante"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
