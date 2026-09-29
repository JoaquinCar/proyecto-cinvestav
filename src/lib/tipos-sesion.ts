// Los tres tipos de actividad del programa, y LA regla de qué cuenta para la
// constancia.
//
// Vocabulario: en la base el registro se llama `Clase` y en pantalla se llama
// «sesión» (ver el comentario sobre `model Clase` en prisma/schema.prisma). Por
// eso el enum de Prisma es `TipoClase` y este módulo —que es el que habla con
// la interfaz— se llama «tipos de sesión». Son lo mismo.
//
//   PASAPORTE — la charla normal. Es lo que el programa ES.
//   LECTURA   — sesión de lectura. Extra OPCIONAL, fuera del pasaporte.
//   EVENTO    — evento especial (día del niño, clausura). Independiente: un
//               mismo día puede haber una sesión de pasaporte y además esto.

import type { TipoClase } from "@prisma/client";

export type TipoSesion = TipoClase;

// ─────────────────────────────────────────────────────────────────────────────
// ⚠️  LA DECISIÓN: QUÉ CUENTA PARA LA CONSTANCIA
//
// La constancia se emite al alcanzar `Edicion.minAsistencias`. Con tres tipos
// de actividad hay que decidir cuáles suman a ese mínimo, y la decisión es:
// SOLO LAS SESIONES DE PASAPORTE. El pasaporte es el programa; la lectura y los
// eventos son extras y no deberían decidir quién recibe constancia.
//
// ESTO NO ESTÁ CONFIRMADO CON EL CLIENTE. Es lo que hay que preguntarle.
//
// Para cambiarlo se toca esta lista Y NADA MÁS. Por ejemplo, para que la
// lectura también cuente:
//
//     export const TIPOS_QUE_CUENTAN_PARA_CONSTANCIA = [
//       "PASAPORTE",
//       "LECTURA",
//     ] as const satisfies readonly TipoSesion[];
//
// De aquí salen los dos filtros de Prisma de más abajo, que son los que usan
// constancias.ts, participantes.ts y estadisticas.ts. No hay ninguna otra
// condición sobre el tipo repartida por el código: si alguien escribe una, las
// pruebas de tests/unit/lib/tipos-sesion.test.ts dejan de ser el candado que
// son y hay que traerla aquí.
// ─────────────────────────────────────────────────────────────────────────────

export const TIPOS_QUE_CUENTAN_PARA_CONSTANCIA = [
  "PASAPORTE",
] as const satisfies readonly TipoSesion[];

/** ¿La asistencia a una actividad de este tipo suma al mínimo de la constancia? */
export function cuentaParaConstancia(tipo: TipoSesion): boolean {
  return (TIPOS_QUE_CUENTAN_PARA_CONSTANCIA as readonly TipoSesion[]).includes(tipo);
}

// Los filtros de abajo se le pasan a Prisma, que exige arreglos mutables en un
// `in`. Se construyen una sola vez a partir de la lista de arriba: nadie debe
// reescribirlos, y quien quiera cambiar el criterio toca la lista, no esto.
const TIPOS_CONTABLES: TipoSesion[] = [...TIPOS_QUE_CUENTAN_PARA_CONSTANCIA];

/**
 * Filtro Prisma para las ASISTENCIAS que suman al mínimo de la constancia.
 *
 * Se usa tal cual en el `where` de la relación `asistencias` de una
 * `Inscripcion`. Incluye `presente: true` porque una asistencia marcada como
 * ausente nunca suma, sea del tipo que sea.
 */
export const ASISTENCIAS_QUE_CUENTAN = {
  presente: true,
  sesion: { clase: { tipo: { in: TIPOS_CONTABLES } } },
};

/**
 * Filtro Prisma para las SESIONES que forman el denominador.
 *
 * Hace falta en el modo «porcentaje mínimo»: si el denominador contara los
 * eventos, un niño que fue a todas las charlas podría quedarse sin constancia
 * por no haber ido a la clausura.
 */
export const CLASES_QUE_CUENTAN = {
  tipo: { in: TIPOS_CONTABLES },
};

// ─────────────────────────────────────────────────────────────────────────────
// Catálogo para la interfaz
// ─────────────────────────────────────────────────────────────────────────────

export type DescripcionTipo = {
  valor: TipoSesion;
  /** Cómo se nombra en singular. */
  etiqueta: string;
  /** Cómo se nombra en plural (encabezados, contadores). */
  plural: string;
  /** Etiqueta corta para las insignias de las tarjetas. */
  corta: string;
  /** Una línea que explica qué es, para los formularios. */
  ayuda: string;
};

/** Orden en que se ofrecen y se listan. El pasaporte primero: es el programa. */
export const TIPOS_SESION = [
  {
    valor: "PASAPORTE",
    etiqueta: "Sesión de pasaporte",
    plural: "Sesiones de pasaporte",
    corta: "Pasaporte",
    ayuda:
      "La charla que imparte un investigador. Es el programa: solo estas cuentan para la constancia.",
  },
  {
    valor: "LECTURA",
    etiqueta: "Sesión de lectura",
    plural: "Sesiones de lectura",
    corta: "Lectura",
    ayuda:
      "Actividad extra y opcional. Se registra su asistencia, pero no suma al mínimo de la constancia.",
  },
  {
    valor: "EVENTO",
    etiqueta: "Evento especial",
    plural: "Eventos especiales",
    corta: "Evento",
    ayuda:
      "Día del niño, clausura y demás. Es independiente: puede caer el mismo día que una sesión de pasaporte.",
  },
] as const satisfies readonly DescripcionTipo[];

const POR_VALOR = new Map<TipoSesion, DescripcionTipo>(
  TIPOS_SESION.map((t) => [t.valor, t]),
);

/** Los valores posibles, para Zod y para los `<select>`. */
export const VALORES_TIPO_SESION = TIPOS_SESION.map((t) => t.valor) as [
  TipoSesion,
  ...TipoSesion[],
];

/** Lo que se crea cuando nadie dice el tipo. Igual que el DEFAULT de la columna. */
export const TIPO_SESION_POR_DEFECTO: TipoSesion = "PASAPORTE";

export function descripcionTipo(tipo: TipoSesion): DescripcionTipo {
  return POR_VALOR.get(tipo) ?? TIPOS_SESION[0];
}

export function etiquetaTipo(tipo: TipoSesion): string {
  return descripcionTipo(tipo).etiqueta;
}

/** Valida un valor que llega de fuera (querystring, formulario, Excel). */
export function esTipoSesion(valor: unknown): valor is TipoSesion {
  return (
    typeof valor === "string" &&
    (VALORES_TIPO_SESION as readonly string[]).includes(valor)
  );
}

/**
 * ¿Este tipo necesita un investigador responsable?
 *
 * Una charla y una lectura las imparte alguien y su nombre va en el reporte.
 * Una clausura no: obligar a inventar uno metería basura en el reporte de la
 * edición. La columna admite NULL; quien lo exige es Zod, con esta función.
 */
export function exigeInvestigador(tipo: TipoSesion): boolean {
  return tipo !== "EVENTO";
}
