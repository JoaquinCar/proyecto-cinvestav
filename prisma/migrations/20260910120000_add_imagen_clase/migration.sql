-- Imágenes de apoyo por clase (fotos, carteles, capturas pegadas del portapapeles).
-- Migración aditiva: no toca ninguna tabla ni dato existente.

-- CreateTable
CREATE TABLE "ImagenClase" (
    "id" TEXT NOT NULL,
    "claseId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "storagePath" TEXT,
    "titulo" TEXT,
    "mimeType" TEXT NOT NULL,
    "tamano" INTEGER NOT NULL DEFAULT 0,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImagenClase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ImagenClase_claseId_idx" ON "ImagenClase"("claseId");

-- AddForeignKey
ALTER TABLE "ImagenClase" ADD CONSTRAINT "ImagenClase_claseId_fkey" FOREIGN KEY ("claseId") REFERENCES "Clase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
