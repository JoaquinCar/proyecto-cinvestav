// Catálogo de columnas de cada tipo de importación.
//
// Los alias salen de los archivos que el organizador YA usa hoy:
//  · scripts/parse-registro.ps1  → tabla de Registro-Pasaporte.docx
//  · asistencia-merida-2026.xlsx → concentrado de asistencia por sesión
//  · GET /api/exportar/excel/[edicionId] → export propio de la app
// Por eso una columna admite varios nombres: importar debe aceptar tanto el
// archivo del organizador como el que la app exporta, sin reescribirlos.

import { normalizarEncabezado } from "./texto";

export const TIPOS_IMPORTACION = ["participantes", "sesiones", "asistencia"] as const;
export type TipoImportacion = (typeof TIPOS_IMPORTACION)[number];

export interface DefinicionColumna {
  /** Nombre canónico interno. */
  clave: string;
  /** Encabezado que lleva la plantilla que descarga el organizador. */
  encabezado: string;
  obligatoria: boolean;
  /** Otros encabezados aceptados (ya normalizados). */
  alias: string[];
  /** Descripción para la guía en pantalla. */
  descripcion: string;
  /** Valores admitidos, para la guía. */
  admite: string;
}

const d = (
  clave: string,
  encabezado: string,
  obligatoria: boolean,
  alias: string[],
  descripcion: string,
  admite: string,
): DefinicionColumna => ({ clave, encabezado, obligatoria, alias, descripcion, admite });

// ── Tipo 1 · Participantes e inscripciones ────────────────────────────────────

export const COLUMNAS_PARTICIPANTES: DefinicionColumna[] = [
  d("nombre", "Nombre", true, ["nombres", "nombre s", "nombre del nino", "nombre a"],
    "Nombre o nombres de pila del niño.", "Texto"),
  d("apellidos", "Apellidos", true, ["apellido", "apellidos paterno y materno"],
    "Apellidos completos. Junto al nombre identifican a la persona.", "Texto"),
  d("edad", "Edad", true, ["edad anos", "anos"],
    "Edad cumplida al momento de la edición.", "Número entero de 2 a 18"),
  d("genero", "Género", false, ["sexo", "genero"],
    "Si se deja vacío queda sin especificar.", "Niña · Niño · F · Femenino · Masculino"),
  d("grado", "Grado", false, ["grado escolar", "ano escolar", "grado que cursa"],
    "Texto libre, tal como lo escribe la familia. Vacío → «Sin especificar».", "Texto libre (4°, Sexto, 2do de secundaria…)"),
  d("nivel", "Nivel", false, ["nivel escolar", "nivel educativo"],
    "Si se deja vacío se deduce del grado, la escuela y la edad.", "Preescolar · Primaria · Secundaria · Media superior · Sin escuela"),
  d("escuela", "Escuela", false, ["escuela de procedencia", "institucion", "colegio"],
    "Vacío o «-» → «Sin escuela».", "Texto libre"),
  d("ciudad", "Ciudad", false, ["municipio", "localidad"],
    "Vacío → «Mérida».", "Texto libre"),
  d("correo", "Correo", false, ["correo electronico", "email", "e mail", "correo del padre o tutor"],
    "Contacto del padre, madre o tutor. Dato sensible: opcional.", "Texto"),
  d("telefono", "Teléfono", false, ["tel", "celular", "telefono de contacto"],
    "Contacto del padre, madre o tutor. Dato sensible: opcional.", "Texto"),
];

// ── Tipo 2 · Calendario de sesiones y asistencia agregada ─────────────────────
// Réplica del concentrado real (asistencia-merida-2026.xlsx). Los conteos por
// nivel son CANTIDAD DE ESCUELAS que asistieron, no de niños: así están en el
// archivo del organizador y así los guarda ResumenSesion.

export const COLUMNAS_SESIONES: DefinicionColumna[] = [
  d("sesion", "SESIÓN", true, ["tema", "titulo", "nombre de la sesion", "actividad"],
    "Tema de la sesión. Si empieza con «1. » ese número se toma como orden.", "Texto"),
  d("sede", "SEDE", false, ["lugar"],
    "Se guarda en la descripción de la clase. Vacío → «MÉRIDA».", "Texto"),
  d("fecha", "FECHA", true, ["dia"],
    "Sin año se asume el año de la edición elegida.", "24 de enero · 24/01/2026 · 2026-01-24 · fecha de Excel"),
  d("clase", "CLASE", false, ["materia"],
    "Opcional. Si se llena, varias sesiones se agrupan bajo esa misma clase; si se deja vacío cada sesión crea su propia clase con el nombre del tema (así está el archivo actual).", "Texto"),
  d("investigador", "INVESTIGADOR", false, ["investigadora", "investigador a", "ponente", "imparte"],
    "Vacío → «Investigador(a) invitado(a) · CINVESTAV».", "Texto"),
  d("ninas", "NIÑAS", false, ["nina"], "Total de niñas asistentes.", "Número entero"),
  d("ninos", "NIÑOS", false, ["nino"], "Total de niños asistentes.", "Número entero"),
  d("total", "TOTAL", false, ["total asistencia", "asistencia total"],
    "Total de niñas + niños. Vacío → se calcula.", "Número entero"),
  d("mamas", "MAMÁS", false, ["mama"], "Madres acompañantes.", "Número entero"),
  d("papas", "PAPÁS", false, ["papa"], "Padres acompañantes.", "Número entero"),
  d("preescolar", "EDUCACIÓN PRE ESCOLAR", false, ["escuelas preescolar", "preescolar", "pre escolar"],
    "Escuelas de preescolar representadas en la sesión.", "Número entero"),
  d("primaria", "EDUCACIÓN PRIMARIA", false, ["escuelas primaria", "primaria"],
    "Escuelas de primaria representadas.", "Número entero"),
  d("secundaria", "EDUCACIÓN SECUNDARIA", false, ["escuelas secundaria", "secundaria"],
    "Escuelas de secundaria representadas.", "Número entero"),
  d("mediaSuperior", "EDUCACIÓN MEDIA SUPERIOR", false, ["escuelas media superior", "media superior"],
    "Escuelas de media superior representadas.", "Número entero"),
  d("notas", "NOTAS", false, ["observaciones", "comentarios"],
    "Comentario libre sobre la sesión.", "Texto"),
];

/** Columnas de conteo por edad del concentrado: encabezado «2» … «18». */
export const EDAD_MIN_COLUMNA = 2;
export const EDAD_MAX_COLUMNA = 18;

// ── Tipo 3 · Asistencia nominal ───────────────────────────────────────────────

export const COLUMNAS_ASISTENCIA: DefinicionColumna[] = [
  d("nombre", "Nombre", true, ["nombres", "nombre s"],
    "Debe coincidir con un participante ya inscrito en la edición.", "Texto"),
  d("apellidos", "Apellidos", true, ["apellido"],
    "Debe coincidir con un participante ya inscrito en la edición.", "Texto"),
];

/**
 * Encabezados que en la hoja de asistencia nominal NO son sesiones: se ignoran
 * en silencio para que la lista del organizador (con su columna de totales o su
 * numeración) se pueda subir tal cual.
 */
export const COLUMNAS_IGNORADAS_ASISTENCIA = new Set(
  [
    "", "#", "no", "num", "numero", "total", "totales", "asistencias",
    "porcentaje", "escuela", "edad", "grado", "nivel", "genero", "sexo",
    "ciudad", "correo", "telefono", "constancia", "observaciones",
  ].map(normalizarEncabezado),
);

// ── Resolución de encabezados ─────────────────────────────────────────────────

export function definicionesDe(tipo: TipoImportacion): DefinicionColumna[] {
  if (tipo === "participantes") return COLUMNAS_PARTICIPANTES;
  if (tipo === "sesiones") return COLUMNAS_SESIONES;
  return COLUMNAS_ASISTENCIA;
}

/** Mapa encabezado-normalizado → clave canónica, para un tipo de importación. */
export function indiceDeAlias(tipo: TipoImportacion): Map<string, string> {
  const mapa = new Map<string, string>();
  for (const col of definicionesDe(tipo)) {
    mapa.set(normalizarEncabezado(col.encabezado), col.clave);
    for (const a of col.alias) mapa.set(normalizarEncabezado(a), col.clave);
  }
  return mapa;
}

/** Nombre bonito de una clave canónica, para los mensajes de error. */
export function encabezadoDe(tipo: TipoImportacion, clave: string): string {
  return definicionesDe(tipo).find((c) => c.clave === clave)?.encabezado ?? clave;
}

export const ETIQUETA_TIPO: Record<TipoImportacion, string> = {
  participantes: "Participantes e inscripciones",
  sesiones: "Sesiones y asistencia agregada",
  asistencia: "Asistencia nominal",
};
