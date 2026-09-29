import { prisma } from "@/server/db";
import { formatearFecha } from "@/lib/fechas";
import { etiquetaTipo } from "@/lib/tipos-sesion";
import { ROL_STAFF_LABEL } from "@/lib/schemas/staff.schema";
import { obtenerListaDeSesion } from "@/server/queries/listas-sesion";
import {
  descargarImagenDeStorage,
  listarImagenesDeClase,
  type ImagenClaseDetalle,
} from "@/server/queries/imagenes-clase";
import type {
  DatosInformeSesion,
  FotoInforme,
} from "@/lib/word/informe-sesion";

// ─────────────────────────────────────────────────────────────────────────────
// Lo que hay que sacar de la base para armar el informe en Word de una sesión.
//
// Esto NO reimplementa la lista de la sesión: llama a `obtenerListaDeSesion`,
// que ya devuelve la sesión con su tipo, sus fechas, los niños que asistieron
// (sin repetirse y ordenados por apellidos) y el staff. Ver su bloque de
// contrato en src/server/queries/listas-sesion.ts.
//
// Lo que esta función añade es lo que aquella no da y el formato sí pide:
//
//   · `objetivo` y `comentarios`, las dos columnas nuevas de `Clase`.
//   · El NÚMERO de sesión («Sesión: 3»), que no es una columna: se deduce de
//     la posición de esta sesión entre las de su mismo tipo en su edición.
//   · Los BYTES de las fotos. El bucket es privado y las imágenes se sirven por
//     un proxy autenticado, así que meterlas en un documento exige leerlas en
//     el servidor; una URL dentro del .docx no la podría abrir nadie.
//
// Recordatorio de vocabulario: `claseId` es el id de lo que la interfaz llama
// «sesión»; las `fechas` son el modelo `Sesion`.
// ─────────────────────────────────────────────────────────────────────────────

export type InformeSesionListo = {
  datos: DatosInformeSesion;
  /** Nombre sugerido del archivo, sin extensión. */
  nombreArchivo: string;
};

/**
 * Devuelve `null` si la sesión no existe, para que la ruta responda 404.
 */
export async function obtenerDatosInformeSesion(
  claseId: string,
): Promise<InformeSesionListo | null> {
  // Deliberadamente SIN `incluirContactoStaff`. Ver el anexo en
  // src/lib/word/informe-sesion.ts: un archivo que sale de la aplicación no
  // lleva teléfonos, y ningún rol lo cambia.
  const lista = await obtenerListaDeSesion(claseId);
  if (!lista) return null;

  const [extra, numero, imagenes] = await Promise.all([
    prisma.clase.findUnique({
      where: { id: claseId },
      select: { objetivo: true, comentarios: true },
    }),
    calcularNumeroDeSesion(claseId, lista.sesion.edicion.id, lista.sesion.tipo),
    listarImagenesDeClase(claseId),
  ]);

  const fotos = await leerFotos(imagenes);

  const datos: DatosInformeSesion = {
    numeroSesion: etiquetaNumero(numero, lista.sesion.tipo),
    fecha: etiquetaFechas(lista.fechas.map((f) => f.fecha)),
    titulo: lista.sesion.nombre,
    autor: lista.sesion.investigador,
    objetivo: extra?.objetivo ?? null,
    descripcion: lista.sesion.descripcion,
    comentarios: extra?.comentarios ?? null,
    fotos,
    anexo: {
      ninos: lista.ninos.map((nino) => ({
        apellidos: nino.apellidos,
        nombre: nino.nombre,
        edad: nino.edad,
        escuela: nino.escuela,
        grado: nino.grado,
      })),
      staff: lista.staff.map((persona) => ({
        nombre: [persona.nombre, persona.apellidos].filter(Boolean).join(" "),
        rol: ROL_STAFF_LABEL[persona.rol],
        institucion: persona.institucion,
      })),
    },
  };

  return {
    datos,
    nombreArchivo: nombreDeArchivo(numero, lista.sesion.nombre, lista.sesion.edicion.anio),
  };
}

// ── El número de sesión ───────────────────────────────────────────────────────

/**
 * En qué posición va esta sesión dentro de su edición, contando solo las de su
 * mismo tipo.
 *
 * El formato dice «Sesión: 3» y en la base no hay ninguna columna que lo diga:
 * el programa es una secuencia de charlas y el número es su posición en el
 * calendario. Se cuenta por tipo porque las tres secuencias son independientes
 * —la tercera lectura del año no es «la sesión 7»— y porque así es como se
 * numeran los informes reales.
 *
 * El orden es por fecha; una sesión sin fecha todavía se va al final, y entre
 * iguales manda el nombre para que el número no baile entre dos exportaciones.
 */
async function calcularNumeroDeSesion(
  claseId: string,
  edicionId: string,
  tipo: "PASAPORTE" | "LECTURA" | "EVENTO",
): Promise<number> {
  const hermanas = await prisma.clase.findMany({
    where: { edicionId, tipo },
    select: {
      id: true,
      nombre: true,
      sesiones: { orderBy: { fecha: "asc" }, take: 1, select: { fecha: true } },
    },
  });

  const ordenadas = hermanas
    .map((clase) => ({
      id: clase.id,
      nombre: clase.nombre,
      fecha: clase.sesiones[0]?.fecha ?? null,
    }))
    .sort((a, b) => {
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

  return ordenadas.findIndex((clase) => clase.id === claseId) + 1;
}

/**
 * El texto que va tras «Sesión: ».
 *
 * En una charla del pasaporte es solo el número, como en los informes reales.
 * En una lectura o un evento se añade de qué tipo es: si no, dos documentos
 * del mismo año dirían «Sesión: 3» refiriéndose a cosas distintas.
 */
function etiquetaNumero(numero: number, tipo: "PASAPORTE" | "LECTURA" | "EVENTO"): string {
  if (tipo === "PASAPORTE") return String(numero);
  return `${numero} · ${etiquetaTipo(tipo)}`;
}

/**
 * El texto que va tras «Fecha: ».
 *
 * Nunca queda vacío: una sesión a la que todavía no se le asignó día imprime
 * por qué no hay fecha, en vez de dejar un renglón colgando que parece un fallo.
 */
function etiquetaFechas(fechas: Date[]): string {
  if (fechas.length === 0) return "sin fecha registrada";
  return fechas.map((fecha) => formatearFecha(fecha, "larga")).join(" y ");
}

// ── Las fotos ─────────────────────────────────────────────────────────────────

/**
 * Baja el binario de cada foto, en el orden de `ImagenClase.orden`.
 *
 * Una foto que no se puede leer —Storage caído, objeto borrado del bucket, fila
 * a medio escribir— se SALTA y el informe sale sin ella. La alternativa sería
 * no entregar nada, y el informe es el trabajo de una tarde entera del
 * coordinador; una foto de menos es un problema mucho menor que un botón de
 * exportar que un día deja de funcionar sin explicar por qué.
 */
async function leerFotos(imagenes: ImagenClaseDetalle[]): Promise<FotoInforme[]> {
  const fotos: FotoInforme[] = [];

  for (const imagen of imagenes) {
    const datos = await bytesDeImagen(imagen);
    if (!datos || datos.length === 0) {
      console.error("[informe-sesion] no se pudo leer una imagen; sale sin ella", {
        imagenId: imagen.id,
      });
      continue;
    }
    fotos.push({ pie: imagen.titulo, mimeType: imagen.mimeType, datos });
  }

  return fotos;
}

/** Data URI del respaldo en base de datos: `data:image/png;base64,…`. */
// `[\s\S]` y no la bandera `s`: el objetivo de compilación es ES2017 y
// `dotAll` no existe ahí.
const DATA_URI = /^data:[^;,]+;base64,([\s\S]*)$/;

async function bytesDeImagen(imagen: ImagenClaseDetalle): Promise<Buffer | null> {
  if (imagen.storagePath) {
    const blob = await descargarImagenDeStorage(imagen.storagePath);
    if (!blob) return null;
    return Buffer.from(await blob.arrayBuffer());
  }

  const coincidencia = DATA_URI.exec(imagen.url);
  if (!coincidencia) return null;
  return Buffer.from(coincidencia[1], "base64");
}

// ── El nombre del archivo ─────────────────────────────────────────────────────

/**
 * «Informe_sesion_3_2026_los-misteriosos-gusanos-marinos».
 *
 * Se construye con lo que el coordinador reconoce —número, año y tema— y no con
 * el id: un `cmtw9tgp5000e…` en la carpeta de descargas no le dice nada a nadie.
 * Se limita a ASCII porque el nombre viaja en una cabecera HTTP.
 */
function nombreDeArchivo(numero: number, nombre: string, anio: number): string {
  const tema = nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);

  return `Informe_sesion_${numero}_${anio}${tema ? `_${tema}` : ""}`;
}
