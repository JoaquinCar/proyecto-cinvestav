import { prisma } from "@/server/db";
import { getSupabaseAdmin } from "@/lib/supabase";
import {
  TAMANO_MAXIMO_IMAGEN,
  type SubirImagenClaseInput,
} from "@/lib/schemas/clase.schema";
import type { TipoSesion } from "@/lib/tipos-sesion";

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

/**
 * La lista con la que se pidió reordenar no es una permutación de las imágenes
 * que hoy tiene la sesión: falta alguna, sobra alguna o viene repetida.
 *
 * El caso normal no es un error de programación sino una carrera: alguien subió
 * o borró una foto mientras otra persona tenía la galería abierta. Aceptarlo a
 * medias dejaría huecos en `orden`, así que se rechaza entero y quien lo pidió
 * recarga.
 */
export class OrdenImagenesInvalidoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OrdenImagenesInvalidoError";
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

/** Campos de una imagen tal como salen de la base, antes de resolver la URL. */
const CAMPOS_IMAGEN = {
  id: true,
  claseId: true,
  url: true,
  storagePath: true,
  titulo: true,
  mimeType: true,
  tamano: true,
  orden: true,
  createdAt: true,
} as const;

/**
 * Orden en que se pinta una galería. SIEMPRE este, en todas las consultas.
 *
 * `orden` manda y hoy es único por sesión, así que los otros dos criterios no
 * deberían llegar a usarse nunca; están porque una fila insertada a mano —o
 * cualquier cosa que se salte `reordenarImagenesDeClase`— no debe convertir el
 * listado en "el que salga": el desempate por `createdAt` y, en última
 * instancia, por `id` lo mantiene determinista entre dos peticiones iguales.
 */
const ORDEN_GALERIA = [
  { orden: "asc" },
  { createdAt: "asc" },
  { id: "asc" },
] as const;

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
    orderBy: [...ORDEN_GALERIA],
    select: CAMPOS_IMAGEN,
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
    select: CAMPOS_IMAGEN,
  });
}

// ── Biblioteca: todas las fotos de una edición, agrupadas por sesión ──────────

/** Una sesión con sus fotos, tal como la pinta la biblioteca. */
export interface GrupoBiblioteca {
  /** Id de la `Clase` — en pantalla, la sesión. */
  claseId: string;
  nombre: string;
  /** Pasaporte, lectura o evento: la biblioteca los agrupa a los tres. */
  tipo: TipoSesion;
  /** `null` en los eventos especiales: una clausura no la imparte nadie. */
  investigador: string | null;
  /** Día en que se impartió; `null` si todavía no se le asignó fecha. */
  fecha: Date | null;
  imagenes: ImagenClaseConUrl[];
}

/**
 * Todas las fotos de una edición, agrupadas por la sesión a la que pertenecen.
 *
 * UNA sola consulta, no una por sesión: la biblioteca de una edición son doce
 * sesiones y varias decenas de fotos, y resolverla con un findMany por sesión
 * multiplicaría los viajes a Supabase sin necesidad. Las imágenes vienen
 * anidadas y ya ordenadas por `orden` desde la base.
 *
 * Se devuelven también las sesiones que todavía no tienen ninguna foto: la
 * biblioteca sirve para armar el reporte, y "a esta sesión le faltan fotos" es
 * justo lo que hay que poder ver de un vistazo. Cuestan una fila cada una.
 *
 * Lo que NO hace esta función es tocar Storage: las URLs que salen apuntan al
 * proxy autenticado, que comprueba la sesión al pedir cada archivo.
 */
export async function listarImagenesDeEdicionPorSesion(
  edicionId: string,
): Promise<GrupoBiblioteca[]> {
  const clases = await prisma.clase.findMany({
    where: { edicionId },
    select: {
      id: true,
      nombre: true,
      // Sin filtrar por tipo: la biblioteca es TODA la memoria gráfica de la
      // edición. De un evento especial —la clausura, el día del niño— es de
      // donde salen las mejores fotos del reporte, y esconderlas aquí obligaría
      // a ir a buscarlas a otra pantalla.
      tipo: true,
      investigador: true,
      // Una clase es una charla impartida en una fecha; el modelo admite
      // varias, y la biblioteca usa la primera para ordenar cronológicamente.
      sesiones: { orderBy: { fecha: "asc" }, select: { fecha: true }, take: 1 },
      imagenes: { orderBy: [...ORDEN_GALERIA], select: CAMPOS_IMAGEN },
    },
  });

  const grupos: GrupoBiblioteca[] = clases.map((clase) => ({
    claseId: clase.id,
    nombre: clase.nombre,
    tipo: clase.tipo,
    investigador: clase.investigador,
    fecha: clase.sesiones[0]?.fecha ?? null,
    imagenes: resolverImagenesParaVista(clase.imagenes),
  }));

  // Cronológico, que es como se recorre el programa y como se arma el reporte.
  // Las sesiones sin fecha van al final (no se puede saber dónde encajan) y,
  // entre iguales, manda el nombre para que el orden no baile entre recargas.
  return grupos.sort((a, b) => {
    if (a.fecha && b.fecha) {
      const diferencia = a.fecha.getTime() - b.fecha.getTime();
      if (diferencia !== 0) return diferencia;
    } else if (a.fecha) {
      return -1;
    } else if (b.fecha) {
      return 1;
    }
    return a.nombre.localeCompare(b.nombre, "es");
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

  let url: string;
  let storagePath: string | null = null;

  if (storageDisponible()) {
    const extension = extensionImagen(input.mimeType);
    // El nombre lleva un sufijo aleatorio y no la posición: `orden` cambia cada
    // vez que alguien reordena la galería, y un archivo cuyo nombre miente
    // sobre dónde está confunde a quien mire el bucket.
    const sufijo = Math.random().toString(36).slice(2, 8);
    const path = `clases/${claseId}/${Date.now()}-${sufijo}.${extension}`;

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

  // La foto nueva va al final de la galería: quien la sube no está decidiendo
  // el orden del reporte, solo agregando material.
  return crearConSiguienteOrden(claseId, {
    url,
    storagePath,
    titulo: input.titulo ?? null,
    mimeType: input.mimeType,
    tamano: buffer.length,
  });
}

/** Cuántas veces se reintenta el alta cuando otra subida se lleva el orden. */
const REINTENTOS_ORDEN = 3;

/**
 * Inserta la imagen con el siguiente `orden` libre de su sesión.
 *
 * "Leer el máximo y sumarle uno" tiene una carrera: dos becarios subiendo a la
 * vez a la misma sesión leen el mismo máximo, y con la unicidad de
 * (claseId, orden) el segundo choca. No se resuelve bloqueando la sesión entera
 * —subir es lo que más se hace en campo y serializarlo sería peor—, sino
 * dejando que choque y volviendo a leer el máximo: en la práctica el segundo
 * intento ya encuentra sitio, y el tope existe para que un fallo distinto no se
 * convierta en un bucle.
 */
async function crearConSiguienteOrden(
  claseId: string,
  datos: {
    url: string;
    storagePath: string | null;
    titulo: string | null;
    mimeType: string;
    tamano: number;
  },
) {
  let ultimoError: unknown;

  for (let intento = 0; intento < REINTENTOS_ORDEN; intento += 1) {
    const ultima = await prisma.imagenClase.findFirst({
      where: { claseId },
      orderBy: { orden: "desc" },
      select: { orden: true },
    });

    try {
      return await prisma.imagenClase.create({
        data: { claseId, ...datos, orden: (ultima?.orden ?? -1) + 1 },
        select: CAMPOS_IMAGEN,
      });
    } catch (error) {
      if (!esChoqueDeOrden(error)) throw error;
      ultimoError = error;
    }
  }

  throw ultimoError;
}

/** P2002: violación de unicidad. Aquí solo puede ser la de (claseId, orden). */
function esChoqueDeOrden(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}

// ── Reordenar ─────────────────────────────────────────────────────────────────

/**
 * Fija el orden de TODAS las fotos de una sesión, en una transacción.
 *
 * Recibe la lista completa de ids en el orden deseado —no "mueve la foto X a la
 * posición N"— por tres razones:
 *
 *   · Es idempotente: reenviarla tras un reintento deja el mismo resultado.
 *   · Sirve igual a los botones de subir/bajar que a cualquier otra forma de
 *     reordenar que se añada después.
 *   · Obliga a que quien reordena tenga la misma lista que la base. Si entre
 *     medias alguien subió o borró una foto, la lista no cuadra y se rechaza
 *     entera en vez de dejar `orden` a medio escribir.
 *
 * La escritura va en DOS fases porque (claseId, orden) es único y PostgreSQL
 * comprueba el índice fila a fila, no al terminar la sentencia: pasar de
 * [a=0,b=1] a [b=0,a=1] de un tirón chocaría al escribir la primera. Primero se
 * aparcan todas en valores negativos —que ninguna fila real usa— y después se
 * escriben los definitivos.
 */
export async function reordenarImagenesDeClase(
  claseId: string,
  ordenIds: string[],
): Promise<ImagenClaseConUrl[]> {
  return prisma.$transaction(async (tx) => {
    const actuales = await tx.imagenClase.findMany({
      where: { claseId },
      orderBy: [...ORDEN_GALERIA],
      select: { id: true },
    });

    const existentes = new Set(actuales.map((imagen) => imagen.id));
    const pedidos = new Set(ordenIds);

    const cuadra =
      ordenIds.length === actuales.length &&
      pedidos.size === ordenIds.length &&
      ordenIds.every((id) => existentes.has(id));

    if (!cuadra) {
      throw new OrdenImagenesInvalidoError(
        "La lista de imágenes ya no coincide con las de esta sesión.",
      );
    }

    // Fase 1: aparcar en negativos, distintos entre sí y libres por definición.
    for (const [indice, id] of ordenIds.entries()) {
      await tx.imagenClase.update({
        where: { id },
        data: { orden: -(indice + 1) },
      });
    }

    // Fase 2: la secuencia definitiva, 0…n-1, sin huecos.
    for (const [indice, id] of ordenIds.entries()) {
      await tx.imagenClase.update({ where: { id }, data: { orden: indice } });
    }

    const nuevas = await tx.imagenClase.findMany({
      where: { claseId },
      orderBy: [...ORDEN_GALERIA],
      select: CAMPOS_IMAGEN,
    });

    return resolverImagenesParaVista(nuevas);
  });
}

/**
 * Elimina una imagen de la base y, si aplica, su archivo en Storage.
 *
 * Al borrar una foto de en medio queda un hueco en `orden` (…, 3, 5, 6), así
 * que las siguientes se compactan en la misma transacción. Un hueco no rompería
 * el orden relativo, pero sí la invariante que el resto del código da por buena
 * —`orden` es siempre 0…n-1— y con ella la única forma de razonar sobre esta
 * columna sin tener que mirar los datos.
 *
 * Se compacta de menor a mayor: cada fila baja a un valor que la anterior acaba
 * de dejar libre, de modo que ninguna actualización intermedia empata con otra.
 */
export async function eliminarImagenClase(id: string) {
  const imagen = await prisma.imagenClase.findUnique({
    where: { id },
    select: { id: true, claseId: true, storagePath: true },
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

  return prisma.$transaction(async (tx) => {
    const borrada = await tx.imagenClase.delete({
      where: { id },
      select: { id: true },
    });

    const restantes = await tx.imagenClase.findMany({
      where: { claseId: imagen.claseId },
      orderBy: [...ORDEN_GALERIA],
      select: { id: true, orden: true },
    });

    for (const [indice, fila] of restantes.entries()) {
      if (fila.orden !== indice) {
        await tx.imagenClase.update({
          where: { id: fila.id },
          data: { orden: indice },
        });
      }
    }

    return borrada;
  });
}
