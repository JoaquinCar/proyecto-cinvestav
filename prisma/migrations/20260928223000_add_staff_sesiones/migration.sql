-- Staff: quien imparte u organiza una sesión, y su asignación a las sesiones.
--
-- Migración ESTRICTAMENTE ADITIVA: no toca ninguna fila ni ninguna columna que
-- ya exista. Todo lo que hace es CREATE.
--   · CREATE TYPE "RolStaff" — enum nuevo, no sustituye a ninguno. En
--     particular NO toca "Role" (ADMIN / BECARIO / READONLY), que es el permiso
--     de una cuenta del sistema y es otra cosa.
--   · CREATE TABLE "Staff" — la ficha de la persona. Nace vacía.
--   · CREATE TABLE "StaffClase" — el enlace persona ↔ sesión. Nace vacía.
--   · Las dos llaves foráneas se crean sobre una tabla vacía, así que su
--     validación no puede fallar contra los datos ya cargados.
--   · NO se añade ninguna columna a "Clase": la relación vive entera en
--     "StaffClase". "Clase" solo gana un campo virtual en el schema de Prisma,
--     que no existe en SQL.
--
-- El UNIQUE ("staffId", "claseId") es la garantía de que una persona no puede
-- quedar asignada dos veces a la misma sesión: se impide en la base, no solo en
-- la interfaz.
--
-- Se aplica en producción con `prisma migrate deploy` sin migrar ni un dato.

-- CreateEnum
CREATE TYPE "RolStaff" AS ENUM ('INVESTIGADOR', 'BECARIO', 'COORDINACION', 'APOYO', 'VOLUNTARIO', 'OTRO');

-- CreateTable
CREATE TABLE "Staff" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellidos" TEXT,
    "telefono" TEXT,
    "correo" TEXT,
    "rol" "RolStaff" NOT NULL DEFAULT 'OTRO',
    "institucion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffClase" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "claseId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffClase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Staff_nombre_apellidos_idx" ON "Staff"("nombre", "apellidos");

-- CreateIndex
CREATE INDEX "StaffClase_claseId_idx" ON "StaffClase"("claseId");

-- CreateIndex
CREATE INDEX "StaffClase_staffId_idx" ON "StaffClase"("staffId");

-- CreateIndex
CREATE UNIQUE INDEX "StaffClase_staffId_claseId_key" ON "StaffClase"("staffId", "claseId");

-- AddForeignKey
ALTER TABLE "StaffClase" ADD CONSTRAINT "StaffClase_claseId_fkey" FOREIGN KEY ("claseId") REFERENCES "Clase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffClase" ADD CONSTRAINT "StaffClase_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
