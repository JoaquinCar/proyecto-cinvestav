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
 * lectura pasa siempre por el proxy autenticado
 * (`GET /api/clases/[id]/imagenes/[imagenId]/archivo`), nunca por
 * `getPublicUrl()` ni por URLs firmadas.
 */
export const BUCKET_IMAGENES = process.env.SUPABASE_BUCKET_CLASES ?? "clases";

/**
 * Prefijo que se guarda en `ImagenClase.url` cuando el archivo vive en Storage.
 * No es una URL descargable a propósito: el archivo solo se sirve a través del
 * proxy autenticado, y si algún código pintara esta columna por error el
 * resultado es una imagen rota, nunca una foto expuesta.
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

/**
 * Ruta del proxy autenticado que sirve el archivo de una imagen.
 *
 * Es estable —depende solo de los ids— y por eso el navegador puede cachearla;
 * a diferencia de una URL firmada, no lleva ningún permiso dentro: el acceso se
 * comprueba en cada petición contra la sesión de quien la pide.
 */
export function rutaArchivoImagen(claseId: string, imagenId: string): string {
  return `/api/clases/${claseId}/imagenes/${imagenId}/archivo`;
}

/**
 * Content-Type que el proxy puede devolver sin riesgo.
 *
 * El `mimeType` guardado en la base se valida con Zod al subir, pero reflejarlo
 * a ciegas convertiría cualquier fila manipulada (por ejemplo `text/html` o
 * `image/svg+xml`) en contenido ejecutable servido desde nuestro propio origen.
 * Solo se devuelven los tipos de imagen que el sistema acepta.
 */
export function tipoImagenSeguro(mimeType: string): string {
  return mimeType in EXTENSIONES ? mimeType : "application/octet-stream";
}

/** Extensión del archivo según su tipo, para el nombre sugerido al descargar. */
export function extensionImagen(mimeType: string): string {
  return EXTENSIONES[mimeType] ?? "bin";
}

// ── Lectura ───────────────────────────────────────────────────────────────────

export type ImagenClaseDetalle = Awaited<
  ReturnType<typeof listarImagenesDeClase>
>[number];

/**
 * Imagen lista para pintar: `url` ya es un data URI o la ruta del proxy.
 *
 * El `Omit` es deliberado: quita del tipo tanto `storagePath` como la columna
 * `url` con la referencia interna `supabase://…`, así que filtrar cualquiera de
 * las dos hacia el navegador no compila.
 */
export type ImagenClaseConUrl = Omit<ImagenClaseDetalle, "url" | "storagePath"> & {
  /** `null` cuando la fila está en un estado que no se puede servir. */
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
 * Ya no hace falta que quien llame tenga sesión para *construir* la URL —la del
 * proxy no concede acceso por sí sola—, pero sí para *usarla*: el proxy vuelve a
 * comprobar la sesión en cada petición del archivo.
 */
export async function listarImagenesDeClaseConUrl(
  claseId: string,
): Promise<ImagenClaseConUrl[]> {
  const imagenes = await listarImagenesDeClase(claseId);
  return resolverImagenesParaVista(imagenes);
}

/**
 * Convierte una fila de `ImagenClase` en una imagen pintable.
 *
 * - Si vive en Storage, apunta al proxy autenticado.
 * - Si es el respaldo en base de datos, devuelve el data URI tal cual.
 * - Si la fila no encaja en ninguno de los dos casos (columna `url` con la
 *   referencia interna y sin `storagePath`, por ejemplo tras un borrado a
 *   medias), devuelve `null` en lugar de la referencia: la galería pinta un
 *   hueco y el resto de la clase se renderiza normal.
 */
export function resolverImagenParaVista(
  imagen: ImagenClaseDetalle,
): ImagenClaseConUrl {
  const { url, storagePath, ...resto } = imagen;

  if (storagePath) {
    return { ...resto, url: rutaArchivoImagen(imagen.claseId, imagen.id) };
  }

  // Respaldo en base de datos: la propia columna ya es un data URI. Cualquier
  // otra cosa no se pinta; nunca se deja escapar `supabase://…`.
  return { ...resto, url: url.startsWith("data:") ? url : null };
}

export function resolverImagenesParaVista(
  imagenes: ImagenClaseDetalle[],
): ImagenClaseConUrl[] {
  return imagenes.map(resolverImagenParaVista);
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

/**
 * Descarga el binario de una imagen desde el bucket privado con `service_role`.
 *
 * Solo debe llamarse desde el proxy, que ya comprobó sesión, rol y que la imagen
 * pertenece a la clase de la URL. Devuelve `null` ante cualquier fallo
 * (credenciales ausentes, red caída, objeto borrado del bucket) para que el
 * proxy responda un error y la galería pinte un hueco, sin tumbar nada más.
 */
export async function descargarImagenDeStorage(
  storagePath: string,
): Promise<Blob | null> {
  if (!storageDisponible()) return null;

  try {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin.storage
      .from(BUCKET_IMAGENES)
      .download(storagePath);

    if (error || !data) return null;
    return data;
  } catch {
    // Se ignora a propósito: arriba se traduce a una respuesta de error.
    return null;
  }
}

// ── Escritura ─────────────────────────────────────────────────────────────────

/**
 * Guarda una imagen de una clase.
 *
 * Si Supabase Storage está configurado sube el archivo al bucket privado y solo
 * guarda su ruta: el archivo se sirve después por el proxy autenticado. Si no lo
 * está, guarda un data URI en la base de datos siempre que la imagen no exceda
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
    const extension = extensionImagen(input.mimeType);
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

    // Nunca se guarda una URL pública ni una URL firmada: el bucket es privado y
    // el archivo se lee por el proxy. Esto solo deja constancia de dónde está.
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
