/**
 * Utilidades de fecha — única forma de formatear fechas en el proyecto.
 *
 * Hay DOS clases de fecha en el dominio y se tratan distinto:
 *
 * 1. FECHAS DE CALENDARIO (`Sesion.fecha`, `Edicion.fechaInicio`, `Edicion.fechaFin`).
 *    Son un día del calendario, sin hora: "el sábado 8 de marzo". Prisma las guarda
 *    en una columna `DateTime`, por convención a medianoche UTC (las importadas del
 *    Excel, a mediodía UTC). Formatearlas con `new Date(f).toLocaleDateString(...)`
 *    las interpreta en la zona local — en Mérida (UTC-6) eso retrocede al día
 *    anterior y el programa sabatino aparece como viernes. Por eso aquí se leen y
 *    se formatean SIEMPRE en UTC: `formatearFecha`, `aISOFecha`, `estaEnRango`.
 *
 * 2. INSTANTES REALES (fecha de emisión de una constancia, `createdAt`). Son un
 *    momento concreto en el tiempo y sí tienen hora. Se formatean en la zona del
 *    programa (`America/Merida`), no en la del servidor: Vercel corre en UTC y a
 *    las 20:00 de Mérida ya sería el día siguiente. Para eso: `formatearInstante`.
 */

/** Zona horaria en la que ocurre el programa (CINVESTAV Unidad Mérida). */
export const ZONA_PROGRAMA = "America/Merida";

const LOCALE = "es-MX";

/** Valores aceptados como fecha: un `Date` de Prisma o una cadena ISO. */
export type FechaEntrada = Date | string;

/** Formatos disponibles; no se usan opciones sueltas para no volver a divergir. */
export type FormatoFecha =
  /** "sábado, 8 de marzo de 2025" */
  | "completa"
  /** "8 de marzo de 2025" */
  | "larga"
  /** "8 de mar de 2025" */
  | "media"
  /** "8 de mar" */
  | "corta"
  /** "sáb, 8 de mar" */
  | "diaSemana";

const OPCIONES: Record<FormatoFecha, Intl.DateTimeFormatOptions> = {
  completa:  { weekday: "long",  day: "numeric", month: "long",  year: "numeric" },
  larga:     {                   day: "numeric", month: "long",  year: "numeric" },
  media:     {                   day: "numeric", month: "short", year: "numeric" },
  corta:     {                   day: "numeric", month: "short"                  },
  diaSemana: { weekday: "short", day: "numeric", month: "short"                  },
};

/** Formateadores memorizados: construir un Intl.DateTimeFormat no es gratis. */
const cache = new Map<string, Intl.DateTimeFormat>();

function formateador(formato: FormatoFecha, zona: string): Intl.DateTimeFormat {
  const clave = `${formato}|${zona}`;
  let fmt = cache.get(clave);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat(LOCALE, { ...OPCIONES[formato], timeZone: zona });
    cache.set(clave, fmt);
  }
  return fmt;
}

/** Extrae el día escrito al inicio de una cadena ISO ("2025-03-08T12:00:00Z"). */
const SOLO_FECHA = /^(\d{4})-(\d{2})-(\d{2})/;

/**
 * Normaliza cualquier fecha de calendario a medianoche UTC del día que representa.
 *
 * Se queda con el día tal como viene escrito (o con el día UTC de un `Date`), sin
 * pasar nunca por la zona local. Es la conversión que debe usarse antes de guardar
 * en la base de datos.
 */
export function aFechaCalendario(valor: FechaEntrada): Date {
  if (valor instanceof Date) {
    if (Number.isNaN(valor.getTime())) {
      throw new RangeError("Fecha inválida");
    }
    return new Date(
      Date.UTC(valor.getUTCFullYear(), valor.getUTCMonth(), valor.getUTCDate()),
    );
  }

  const coincidencia = SOLO_FECHA.exec(valor.trim());
  if (!coincidencia) {
    throw new RangeError(`Fecha inválida: ${valor}`);
  }

  const [, anio, mes, dia] = coincidencia;
  const fecha = new Date(Date.UTC(Number(anio), Number(mes) - 1, Number(dia)));

  // Descarta imposibles como 2025-02-31, que Date.UTC desbordaría en silencio.
  if (fecha.getUTCMonth() !== Number(mes) - 1 || fecha.getUTCDate() !== Number(dia)) {
    throw new RangeError(`Fecha inválida: ${valor}`);
  }

  return fecha;
}

/** Día de calendario como "YYYY-MM-DD" (para `<input type="date">`, `<time>` y claves). */
export function aISOFecha(valor: FechaEntrada): string {
  return aFechaCalendario(valor).toISOString().slice(0, 10);
}

/** Formatea una fecha de calendario en español, sin correrla de día. */
export function formatearFecha(
  valor: FechaEntrada,
  formato: FormatoFecha = "larga",
): string {
  return formateador(formato, "UTC").format(aFechaCalendario(valor));
}

/** Rango de fechas de calendario: "1 de feb – 30 de jun de 2025". */
export function formatearRangoFechas(inicio: FechaEntrada, fin: FechaEntrada): string {
  return `${formatearFecha(inicio, "corta")} – ${formatearFecha(fin, "media")}`;
}

/**
 * Formatea un INSTANTE real (no una fecha de calendario) en la zona del programa.
 * Úsalo solo cuando el valor represente un momento concreto, como `new Date()`.
 */
export function formatearInstante(
  valor: Date = new Date(),
  formato: FormatoFecha = "larga",
): string {
  return formateador(formato, ZONA_PROGRAMA).format(valor);
}

/**
 * ¿La fecha cae dentro del rango (extremos incluidos)? Compara días de calendario,
 * no instantes: una edición guardada a mediodía UTC no debe excluir a las sesiones
 * de su primer día, guardadas a medianoche.
 */
export function estaEnRango(
  fecha: FechaEntrada,
  inicio: FechaEntrada,
  fin: FechaEntrada,
): boolean {
  const dia = aFechaCalendario(fecha).getTime();
  return dia >= aFechaCalendario(inicio).getTime() && dia <= aFechaCalendario(fin).getTime();
}

/** Mensaje para el usuario cuando una fecha cae fuera del rango de su edición. */
export function mensajeFueraDeRango(inicio: FechaEntrada, fin: FechaEntrada): string {
  return (
    `La fecha debe estar dentro de la edición: del ${formatearFecha(inicio)} ` +
    `al ${formatearFecha(fin)}`
  );
}
