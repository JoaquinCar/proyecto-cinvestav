-- AlterTable
ALTER TABLE "Edicion" ADD COLUMN     "cerrada" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "cerradaAt" TIMESTAMP(3);
