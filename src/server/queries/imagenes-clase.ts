import { prisma } from "@/server/db";
import { getSupabaseAdmin } from "@/lib/supabase";
import {
  TAMANO_MAXIMO_IMAGEN,
  type SubirImagenClaseInput,
} from "@/lib/schemas/clase.schema";

// ── Constantes ────────────────────────────────────────────────────────────────

/**
 * Bucket de Supabase Storage donde viven las imágenes de las clases.
 *
 * El bucket debe ser PÚBLICO: la subida usa la clave service_role y se salta las
 * políticas, pero `getPublicUrl()` solo arma la cadena y no comprueba nada, así
 * que con un bucket privado las imágenes se guardarían bien y se verían rotas,
 * sin error en ninguna parte.
 */
export const BUCKET_IMAGENES = process.env.SUPABASE_BUCKET_CLASES ?? "clases-cinvestav";

/**
 * Límite del respaldo en base de datos. Sin Supabase Storage la imagen se guarda
 * como data URI dentro de la columna `url`, así que se mantiene deliberadamente
 * bajo para no inflar la base (Supabase Free Tier).
 */
export const TAMANO_MAXIMO_DATA_URI = 1024 * 1024; // 1 MB

const EXTENSIONES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

// ── Errores ───────────────────────────────────────────────────────────────────

/** La imagen es válida pero no se puede almacenar (tamaño o storage no disponible). */
export class ImagenNoAlmacenableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImagenNoAlmacenableError";
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Indica si Supabase Storage está configurado en este entorno. */
export function storageDisponible(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

// ── Lectura ───────────────────────────────────────────────────────────────────

export type ImagenClaseDetalle = Awaited<
  ReturnType<typeof listarImagenesDeClase>
>[number];

export async function listarImagenesDeClase(claseId: string) {
  return prisma.imagenClase.findMany({
    where: { claseId },
    orderBy: [{ orden: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      claseId: true,
      url: true,
      titulo: true,
      mimeType: true,
      tamano: true,
      orden: true,
      createdAt: true,
    },
  });
}

export async function obtenerImagenClase(id: string) {
  return prisma.imagenClase.findUnique({
    where: { id },
    select: {
      id: true,
      claseId: true,
      url: true,
      storagePath: true,
      titulo: true,
      mimeType: true,
      tamano: true,
      orden: true,
      createdAt: true,
    },
  });
}

// ── Escritura ─────────────────────────────────────────────────────────────────

/**
 * Guarda una imagen de una clase.
 *
 * Si Supabase Storage está configurado sube el archivo al bucket `clases` y
 * guarda la URL pública. Si no lo está, guarda un data URI en la base de datos
 * siempre que la imagen no exceda `TAMANO_MAXIMO_DATA_URI`.
 */
export async function crearImagenClase(
  claseId: string,
  input: SubirImagenClaseInput,
) {
  const buffer = Buffer.from(input.data, "base64");

  if (buffer.length === 0) {
    throw new ImagenNoAlmacenableError("La imagen está vacía");
  }

  if (buffer.length > TAMANO_MAXIMO_IMAGEN) {
    throw new ImagenNoAlmacenableError(
      "La imagen supera el tamaño máximo de 3 MB",
    );
  }

  const ultima = await prisma.imagenClase.findFirst({
    where: { claseId },
    orderBy: { orden: "desc" },
    select: { orden: true },
  });
  const orden = (ultima?.orden ?? -1) + 1;

  let url: string;
  let storagePath: string | null = null;

  if (storageDisponible()) {
    const extension = EXTENSIONES[input.mimeType] ?? "bin";
    const path = `clases/${claseId}/${Date.now()}-${orden}.${extension}`;

    const admin = getSupabaseAdmin();
    const { error } = await admin.storage
      .from(BUCKET_IMAGENES)
      .upload(path, buffer, { contentType: input.mimeType, upsert: false });

    if (error) {
      throw new ImagenNoAlmacenableError(
        `Error al subir la imagen: ${error.message}`,
      );
    }

    const {
      data: { publicUrl },
    } = admin.storage.from(BUCKET_IMAGENES).getPublicUrl(path);

    url = publicUrl;
    storagePath = path;
  } else {
    // Respaldo: sin Storage configurado la imagen vive en la base como data URI.
    if (buffer.length > TAMANO_MAXIMO_DATA_URI) {
      throw new ImagenNoAlmacenableError(
        "El almacenamiento de imágenes no está configurado; sin él solo se aceptan imágenes de hasta 1 MB",
      );
    }
    url = `data:${input.mimeType};base64,${buffer.toString("base64")}`;
  }

  return prisma.imagenClase.create({
    data: {
      claseId,
      url,
      storagePath,
      titulo: input.titulo ?? null,
      mimeType: input.mimeType,
      tamano: buffer.length,
      orden,
    },
    select: {
      id: true,
      claseId: true,
      url: true,
      titulo: true,
      mimeType: true,
      tamano: true,
      orden: true,
      createdAt: true,
    },
  });
}

/** Elimina una imagen de la base y, si aplica, su archivo en Storage. */
export async function eliminarImagenClase(id: string) {
  const imagen = await prisma.imagenClase.findUnique({
    where: { id },
    select: { id: true, storagePath: true },
  });

  if (!imagen) return null;

  if (imagen.storagePath && storageDisponible()) {
    // Si el borrado en Storage falla no bloqueamos el borrado del registro:
    // el usuario espera que la imagen desaparezca de la clase.
    try {
      const admin = getSupabaseAdmin();
      await admin.storage.from(BUCKET_IMAGENES).remove([imagen.storagePath]);
    } catch {
      // Ignorado a propósito.
    }
  }

  return prisma.imagenClase.delete({ where: { id }, select: { id: true } });
}
