// ─────────────────────────────────────────────────────────────────────────────
// QUÉ CUENTA COMO «SESIÓN IMPARTIDA» — definición única del sistema.
//
// Recordatorio de nombres: en pantalla, «sesión» es el modelo `Clase` y
// «fecha» es el modelo `Sesion`. Aquí se habla del modelo `Sesion`, que es la
// fila que tiene fecha y asistencia.
//
// ── El defecto ──────────────────────────────────────────────────────────────
// El dashboard contaba como impartidas SOLO las sesiones con `ResumenSesion`,
// es decir los totales agregados que únicamente entran importando el Excel del
// organizador (o con scripts/cargar-2026.mjs). Crear la sesión en la
// aplicación, ponerle fecha y pasar lista no genera ningún `ResumenSesion`, así
// que una edición capturada entera desde la app salía en «0/7» y nada de lo que
// se hacía en pantalla movía ese número. QA lo dijo exacto: «no sé qué activa
// las sesiones».
//
// ── La definición ───────────────────────────────────────────────────────────
// Una sesión está IMPARTIDA cuando SU FECHA YA PASÓ. Nada más: ni resumen, ni
// lista, ni captura de ningún tipo. Si el día llegó y se fue, la sesión se dio.
//
// Lo decidió el coordinador del programa, y el flujo real lo sostiene: «sábado
// se hacen las sesiones y domingo se cargan a la plataforma». Cuando alguien
// crea una sesión en la aplicación, la fecha que le pone ya está en el pasado,
// así que nace impartida. Es también lo único que cualquiera puede verificar
// mirando la pantalla, sin saber qué es un `ResumenSesion`.
//
// La captura NO desapareció del tablero: sigue reportándose aparte, como
// «sesiones con asistencia capturada» y «impartidas sin capturar». Lo que se
// quitó es que la captura decidiera si una sesión se impartió.
//
// ── La frontera del día ─────────────────────────────────────────────────────
// `Sesion.fecha` es una FECHA DE CALENDARIO (ver src/lib/fechas.ts), guardada a
// medianoche UTC si la creó la aplicación y a mediodía UTC si vino del Excel.
// La comparación se hace contra el día de HOY en America/Merida, normalizado a
// medianoche UTC: ambas convenciones de guardado caen dentro de la franja
// [00:00, 24:00) UTC de su día, así que `fecha < hoy` funciona para las dos.
// Comparar contra `new Date()` en un servidor en UTC adelantaría seis horas la
// sesión del sábado. Y es ESTRICTO: una sesión de hoy todavía no se impartió.
//
// ── Clases con varias fechas ────────────────────────────────────────────────
// En el modelo, una `Clase` (la «sesión» de la interfaz) puede colgar varias
// `Sesion` (las «fechas»). Hoy los datos son 1:1 — las 14 clases de la base
// tienen exactamente una fecha cada una — y el contador cuenta FECHAS, que es
// lo que siempre ha contado `totalSesiones` y lo que corresponde a «¿cuántas
// veces nos juntamos?». Si algún día una clase tiene dos fechas, cada una suma
// por separado en cuanto pasa, que es la lectura honesta: una clase con la
// primera fecha pasada y la segunda por venir está impartida a medias, y el
// denominador lo refleja.
//
// ── Precedencia de las fuentes de asistencia ────────────────────────────────
// Para los números de asistencia (totales, promedio, pico, gráficas) manda el
// agregado cuando existe: es el conteo que el organizador cerró a mano e
// incluye acompañantes y público que no está inscrito, mientras que la lista
// individual solo puede ver a los niños inscritos. Si no hay agregado se usa la
// lista — antes no se usaba, y por eso una edición capturada en la aplicación
// mostraba todo el panel de asistencia en cero.
// ─────────────────────────────────────────────────────────────────────────────

import type { Nivel } from "@/lib/importacion/texto";
import { hoyEnZonaPrograma } from "@/lib/fechas";

/**
 * Filtro de Prisma equivalente a «su fecha ya pasó», para los conteos que no
 * necesitan traerse las filas. Es una función y no una constante porque
 * depende de qué día es hoy.
 */
export function filtroSesionImpartida(ahora: Date = new Date()): {
  fecha: { lt: Date };
} {
  return { fecha: { lt: hoyEnZonaPrograma(ahora) } };
}

/**
 * `select` de Prisma para traer la lista individual con lo mínimo que hace
 * falta para derivar los agregados de una sesión sin resumen importado.
 */
export const SELECCION_LISTA = {
  where: { presente: true },
  select: {
    inscripcion: {
      select: {
        participante: {
          select: { genero: true, edad: true, nivel: true },
        },
      },
    },
  },
} as const;

/** De dónde salió la asistencia de una sesión. */
export type OrigenAsistencia = "AGREGADA" | "LISTA";

export type AsistenciaDeSesion = {
  ninas: number;
  ninos: number;
  total: number;
  /**
   * Acompañantes. Solo el agregado del Excel los registra: la lista individual
   * de la aplicación es de niños inscritos y no tiene dónde apuntar al adulto
   * que vino con ellos, así que en una sesión capturada en la app salen en 0.
   */
  mamas: number;
  papas: number;
  preescolar: number;
  primaria: number;
  secundaria: number;
  mediaSuperior: number;
  porEdad: Record<string, number>;
  origen: OrigenAsistencia;
};

// Toda la unión `Nivel` tiene que estar aquí: un nivel sin etiqueta cae en
// "Sin especificar" y su barra sale sin nombre en la gráfica.
export const NIVEL_LABEL: Record<Nivel, string> = {
  PREESCOLAR: "Preescolar",
  PRIMARIA: "Primaria",
  SECUNDARIA: "Secundaria",
  MEDIA_SUPERIOR: "Media superior",
  UNIVERSIDAD: "Universidad",
  SIN_ESCUELA: "Sin escuela",
};

export const NIVEL_ORDEN: Record<string, number> = {
  Preescolar: 0,
  Primaria: 1,
  Secundaria: 2,
  "Media superior": 3,
  Universidad: 4,
  "Sin escuela": 5,
};

/**
 * `Participante.nivel` es texto libre en la base (se llenó con el importador y
 * puede estar vacío en fichas antiguas). Esto lo traduce a la etiqueta que va
 * en la gráfica y nunca deja a nadie sin agrupar.
 */
export function etiquetaNivel(nivel: string | null | undefined): string {
  if (!nivel) return "Sin especificar";
  return NIVEL_LABEL[nivel as Nivel] ?? "Sin especificar";
}

/** La forma mínima que necesita `asistenciaDeSesion` de una fila `Sesion`. */
export type SesionConAsistencia = {
  resumen: {
    ninas: number;
    ninos: number;
    total: number;
    mamas: number;
    papas: number;
    preescolar: number;
    primaria: number;
    secundaria: number;
    mediaSuperior: number;
    porEdad: unknown;
  } | null;
  asistencias: {
    inscripcion: {
      participante: {
        genero: "FEMENINO" | "MASCULINO" | null;
        edad: number;
        nivel: string | null;
      };
    };
  }[];
};

/**
 * Asistencia efectiva de una sesión, o `null` si nadie la registró todavía —
 * que es exactamente lo que significa «no impartida».
 */
export function asistenciaDeSesion(
  sesion: SesionConAsistencia,
): AsistenciaDeSesion | null {
  const r = sesion.resumen;
  if (r) {
    return {
      ninas: r.ninas,
      ninos: r.ninos,
      total: r.total,
      mamas: r.mamas,
      papas: r.papas,
      preescolar: r.preescolar,
      primaria: r.primaria,
      secundaria: r.secundaria,
      mediaSuperior: r.mediaSuperior,
      porEdad: (r.porEdad ?? {}) as Record<string, number>,
      origen: "AGREGADA",
    };
  }

  const lista = sesion.asistencias ?? [];
  if (lista.length === 0) return null;

  const a: AsistenciaDeSesion = {
    ninas: 0,
    ninos: 0,
    total: lista.length,
    mamas: 0,
    papas: 0,
    preescolar: 0,
    primaria: 0,
    secundaria: 0,
    mediaSuperior: 0,
    porEdad: {},
    origen: "LISTA",
  };

  for (const { inscripcion } of lista) {
    const p = inscripcion.participante;
    if (p.genero === "FEMENINO") a.ninas += 1;
    else if (p.genero === "MASCULINO") a.ninos += 1;

    switch (etiquetaNivel(p.nivel)) {
      case "Preescolar":
        a.preescolar += 1;
        break;
      case "Primaria":
        a.primaria += 1;
        break;
      case "Secundaria":
        a.secundaria += 1;
        break;
      case "Media superior":
        a.mediaSuperior += 1;
        break;
    }

    if (p.edad > 0) {
      const k = String(p.edad);
      a.porEdad[k] = (a.porEdad[k] ?? 0) + 1;
    }
  }

  return a;
}
