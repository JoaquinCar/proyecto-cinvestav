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
 * El bucket debe ser PRIVADO: en estas fotos aparecen menores de edad y un
 * bucket público las deja accesibles a cualquiera que tenga la URL, sin sesión.
 * La subida usa la clave service_role, que se salta las políticas RLS, y la
 * lectura se hace siempre con URLs firmadas de caducidad corta
 * (`resolverUrlImagen`), nunca con `getPublicUrl()`.
 */
export const BUCKET_IMAGENES = process.env.SUPABASE_BUCKET_CLASES ?? "clases";

/**
 * Caducidad de las URLs firmadas, en segundos.
 *
 * 30 minutos es un equilibrio deliberado: las miniaturas se cargan con
 * `loading="lazy"`, así que una imagen puede pedirse bastante después de que la
 * página se renderizó (el becario baja por la galería con el teléfono ya
 * bloqueado y desbloqueado varias veces). Menos tiempo produciría imágenes rotas
 * en campo; más tiempo alarga la ventana en la que una URL filtrada —una captura
 * compartida, el historial del navegador— sigue sirviendo la foto de un niño.
 */
export const EXPIRACION_URL_FIRMADA = 60 * 30;

/**
 * Prefijo que se guarda en `ImagenClase.url` cuando el archivo vive en Storage.
 * No es una URL descargable a propósito: la URL real se firma en cada render, y
 * si algún código la pintara por error el resultado es una imagen rota, nunca
 * una foto expuesta.
 */
const PREFIJO_STORAGE = "supabase://";

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

/** Imagen lista para pintar: `url` ya es un data URI o una URL firmada vigente. */
export type ImagenClaseConUrl = Omit<ImagenClaseDetalle, "url" | "storagePath"> & {
  /** `null` cuando el archivo está en Storage y no se pudo firmar la URL. */
  url: string | null;
};

export async function listarImagenesDeClase(claseId: string) {
  return prisma.imagenClase.findMany({
    where: { claseId },
    orderBy: [{ orden: "asc" }, { createdAt: "asc" }],
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

/**
 * Lista las imágenes de una clase con una URL utilizable en el navegador.
 *
 * Quien llame a esta función es responsable de haber comprobado la sesión y el
 * rol: firmar una URL es dar acceso a la foto, así que nunca debe invocarse
 * desde una vista pública.
 *
 * Si el firmado falla (credenciales, red, archivo borrado del bucket) la imagen
 * viaja con `url: null` en lugar de tirar la página entera: la galería pinta un
 * hueco y el resto de la clase sigue funcionando.
 */
export async function listarImagenesDeClaseConUrl(
  claseId: string,
): Promise<ImagenClaseConUrl[]> {
  const imagenes = await listarImagenesDeClase(claseId);
  return firmarImagenes(imagenes);
}

/**
 * Convierte filas de `ImagenClase` en imágenes pintables.
 *
 * Las que viven en la base (respaldo data URI) se devuelven tal cual; las que
 * viven en Storage se firman en un solo viaje con `createSignedUrls`.
 */
export async function firmarImagenes(
  imagenes: ImagenClaseDetalle[],
): Promise<ImagenClaseConUrl[]> {
  const enStorage = imagenes.filter((imagen) => Boolean(imagen.storagePath));

  const firmadas = new Map<string, string>();

  if (enStorage.length > 0 && storageDisponible()) {
    try {
      const admin = getSupabaseAdmin();
      const { data, error } = await admin.storage
        .from(BUCKET_IMAGENES)
        .createSignedUrls(
          enStorage.map((imagen) => imagen.storagePath as string),
          EXPIRACION_URL_FIRMADA,
        );

      if (!error && data) {
        for (const firma of data) {
          if (firma.path && firma.signedUrl && !firma.error) {
            firmadas.set(firma.path, firma.signedUrl);
          }
        }
      }
    } catch {
      // Se ignora a propósito: abajo cada imagen sin firma sale con url null.
    }
  }

  return imagenes.map((imagen) => {
    const { url, storagePath, ...resto } = imagen;

    if (!storagePath) {
      // Respaldo en base de datos: la propia columna ya es un data URI.
      return { ...resto, url };
    }

    return { ...resto, url: firmadas.get(storagePath) ?? null };
  });
}

/** Firma una sola imagen. Devuelve `null` si no se pudo. */
export async function resolverUrlImagen(
  imagen: ImagenClaseDetalle,
): Promise<string | null> {
  const [resuelta] = await firmarImagenes([imagen]);
  return resuelta?.url ?? null;
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
 * Si Supabase Storage está configurado sube el archivo al bucket privado y solo
 * guarda su ruta: la URL de lectura se firma en cada render. Si no lo está,
 * guarda un data URI en la base de datos siempre que la imagen no exceda
 * `TAMANO_MAXIMO_DATA_URI`.
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

    // Nunca se guarda una URL pública: el bucket es privado y la URL de lectura
    // se firma al renderizar. Esto solo deja constancia de dónde está el archivo.
    url = `${PREFIJO_STORAGE}${BUCKET_IMAGENES}/${path}`;
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
      storagePath: true,
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
