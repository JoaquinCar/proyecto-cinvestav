-- CreateEnum
CREATE TYPE "Genero" AS ENUM ('FEMENINO', 'MASCULINO');

-- AlterTable
ALTER TABLE "Participante" ADD COLUMN "genero" "Genero";
