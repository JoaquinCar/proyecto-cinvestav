-- AlterTable
ALTER TABLE "Participante" ADD COLUMN     "ciudad" TEXT,
ADD COLUMN     "correo" TEXT,
ADD COLUMN     "nivel" TEXT,
ADD COLUMN     "telefono" TEXT;

-- CreateTable
CREATE TABLE "ResumenSesion" (
    "id" TEXT NOT NULL,
    "sesionId" TEXT NOT NULL,
    "ninas" INTEGER NOT NULL DEFAULT 0,
    "ninos" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL DEFAULT 0,
    "mamas" INTEGER NOT NULL DEFAULT 0,
    "papas" INTEGER NOT NULL DEFAULT 0,
    "preescolar" INTEGER NOT NULL DEFAULT 0,
    "primaria" INTEGER NOT NULL DEFAULT 0,
    "secundaria" INTEGER NOT NULL DEFAULT 0,
    "mediaSuperior" INTEGER NOT NULL DEFAULT 0,
    "porEdad" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResumenSesion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ResumenSesion_sesionId_key" ON "ResumenSesion"("sesionId");

-- AddForeignKey
ALTER TABLE "ResumenSesion" ADD CONSTRAINT "ResumenSesion_sesionId_fkey" FOREIGN KEY ("sesionId") REFERENCES "Sesion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
