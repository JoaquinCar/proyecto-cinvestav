// Contenido de la guía que se ve en pantalla ANTES de subir nada.
// Se arma desde el mismo catálogo de columnas que usa el parser, así que la
// guía nunca puede quedar desfasada del código que valida.

import {
  COLUMNAS_PARTICIPANTES,
  COLUMNAS_SESIONES,
  EDAD_MAX_COLUMNA,
  EDAD_MIN_COLUMNA,
  ETIQUETA_TIPO,
  TIPOS_IMPORTACION,
  definicionesDe,
  type TipoImportacion,
} from "./columnas";
import { plantillaDe } from "./plantillas";

export interface ColumnaGuia {
  encabezado: string;
  obligatoria: boolean;
  admite: string;
  descripcion: string;
  alias: string[];
}

export interface Guia {
  tipo: TipoImportacion;
  paso: number;
  titulo: string;
  resumen: string;
  cuando: string;
  origen: string;
  requisitos: string[];
  columnas: ColumnaGuia[];
  columnasExtra: { encabezado: string; descripcion: string }[];
  ejemplo: { encabezados: string[]; filas: string[][] };
  duplicados: string[];
}

const RESUMEN: Record<TipoImportacion, string> = {
  participantes:
    "Da de alta a los niños y los inscribe en la edición que elijas. Un participante es global: si ya vino en otro año, no se duplica.",
  sesiones:
    "Crea el calendario de la edición (clases y sesiones) y guarda los totales de asistencia por sesión.",
  asistencia:
    "Marca, niño por niño, a qué sesiones asistió. Es lo que alimenta el mínimo de asistencias y las constancias.",
};

const CUANDO: Record<TipoImportacion, string> = {
  participantes: "Primero. Todo lo demás depende de que los niños ya estén inscritos.",
  sesiones: "Segundo. Necesita que la edición exista; no depende de los participantes.",
  asistencia: "Al final. Requiere que ya existan los participantes inscritos y las sesiones.",
};

const ORIGEN: Record<TipoImportacion, string> = {
  participantes:
    "Es la tabla del registro que llena el organizador (Registro-Pasaporte.docx), pegada en Excel. También se acepta tal cual el archivo que exporta esta misma app desde Estadísticas.",
  sesiones:
    "Es el concentrado que ya usa el organizador (asistencia-merida-2026.xlsx), con sus dos renglones de encabezado y sus columnas de edades. Se puede subir sin tocarlo.",
  asistencia:
    "Es la lista de pase de asistencia: los niños en las filas y una columna por sesión, marcando con «X» quién asistió.",
};

const REQUISITOS: Record<TipoImportacion, string[]> = {
  participantes: [
    "La primera hoja del archivo es la que se lee; las demás se ignoran.",
    "El renglón de encabezados puede estar en cualquiera de las primeras 15 filas.",
    "Las columnas se reconocen por su NOMBRE, no por su posición: puedes reordenarlas.",
    "Las columnas que no reconoce (por ejemplo «#» o «Participación») se ignoran sin dar error.",
    "Máximo 2 000 filas y 5 MB por archivo.",
  ],
  sesiones: [
    "Se admite el encabezado de dos renglones del concentrado original (con celdas combinadas) y también uno de un solo renglón.",
    "El renglón de TOTALES al final del concentrado se salta solo.",
    "Las fechas sin año («24 de enero») toman el año de la edición que elijas arriba.",
    "Los conteos por nivel son CANTIDAD DE ESCUELAS que asistieron, no de niños: así viene en el archivo original.",
    "Las sesiones sin totales se crean igual, marcadas como «sin datos de asistencia».",
  ],
  asistencia: [
    "Después de «Nombre» y «Apellidos», cada columna es una sesión.",
    "El encabezado de cada sesión puede ser la fecha («24/01/2026», «24 de enero», o una fecha de Excel) o el nombre de la clase.",
    "Las columnas de apoyo («Total», «Escuela», «#»…) se ignoran solas.",
    "Los niños que no estén inscritos en la edición se reportan como error con su número de fila; no se crean solos.",
  ],
};

const DUPLICADOS: Record<TipoImportacion, string[]> = {
  participantes: [
    "Un participante se identifica por NOMBRE + APELLIDOS, sin distinguir acentos ni mayúsculas: «MAXIMA INTERIAN» y «Máxima Interián» son la misma persona.",
    "Si el niño ya existe de una edición anterior, NO se crea otro: se reutiliza y solo se le agrega la inscripción del año elegido. Es el caso del niño que repite.",
    "Si el niño ya está inscrito en esta edición, no se duplica la inscripción; a lo más se actualizan sus datos (edad, grado, escuela…).",
    "Solo se sobrescriben los campos que el archivo trae llenos: una celda vacía nunca borra un dato que ya está en el sistema.",
    "Si la misma persona aparece dos veces dentro del archivo, se toma la primera y la segunda se omite con un aviso que dice en qué fila estaba.",
    "Volver a subir el mismo archivo no cambia nada: todas las filas salen como «sin cambios».",
  ],
  sesiones: [
    "Una clase se identifica por su nombre dentro de la edición; si ya existe, se reutiliza en vez de crear otra igual.",
    "Una sesión se identifica por clase + día. Si ya existe, se actualizan su tema, sus notas y sus totales.",
    "Volver a subir el mismo concentrado actualiza los totales, no crea sesiones repetidas.",
    "Si dos filas del archivo son la misma clase el mismo día, se toma la primera y la otra se omite con aviso.",
  ],
  asistencia: [
    "Una asistencia se identifica por inscripción + sesión: no puede haber dos registros del mismo niño en la misma sesión.",
    "Si el registro ya existe con el mismo valor, no se toca; si cambió (de ausente a presente, por ejemplo), se corrige.",
    "Volver a subir la misma lista deja todo igual.",
  ],
};

const COLUMNAS_EXTRA: Record<TipoImportacion, { encabezado: string; descripcion: string }[]> = {
  participantes: [],
  sesiones: [
    {
      encabezado: `${EDAD_MIN_COLUMNA} … ${EDAD_MAX_COLUMNA}`,
      descripcion:
        "Opcionales. Una columna por edad, con el encabezado puesto en el número de años (2, 3, 4… 18) y el conteo de niños de esa edad en la sesión. Es el bloque «NIÑOS POR EDADES» del concentrado.",
    },
  ],
  asistencia: [
    {
      encabezado: "Una columna por sesión",
      descripcion:
        "Obligatorio al menos una. El encabezado es la fecha o el nombre de la clase. En la celda: «X» (o «Sí», «1», «P») si asistió; vacío, «-» o «0» si no.",
    },
  ],
};

function aColumnaGuia(tipo: TipoImportacion): ColumnaGuia[] {
  return definicionesDe(tipo).map((c) => ({
    encabezado: c.encabezado,
    obligatoria: c.obligatoria,
    admite: c.admite,
    descripcion: c.descripcion,
    alias: c.alias,
  }));
}

export function construirGuias(anio: number): Guia[] {
  return TIPOS_IMPORTACION.map((tipo, i) => {
    const { encabezados, ejemplos } = plantillaDe(tipo, anio);
    // El ejemplo en pantalla se recorta a lo que cabe; el .xlsx trae todo.
    const limite = tipo === "sesiones" ? COLUMNAS_SESIONES.length : encabezados.length;
    return {
      tipo,
      paso: i + 1,
      titulo: ETIQUETA_TIPO[tipo],
      resumen: RESUMEN[tipo],
      cuando: CUANDO[tipo],
      origen: ORIGEN[tipo],
      requisitos: REQUISITOS[tipo],
      columnas: aColumnaGuia(tipo),
      columnasExtra: COLUMNAS_EXTRA[tipo],
      ejemplo: {
        encabezados: encabezados.slice(0, limite),
        filas: ejemplos.map((f) => f.slice(0, limite).map((v) => String(v ?? ""))),
      },
      duplicados: DUPLICADOS[tipo],
    };
  });
}

/** Cuántas columnas obligatorias tiene cada tipo (para el resumen de la guía). */
export const OBLIGATORIAS_PARTICIPANTES = COLUMNAS_PARTICIPANTES.filter(
  (c) => c.obligatoria,
).length;
