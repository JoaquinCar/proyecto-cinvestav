// ─────────────────────────────────────────────────────────────────────────────
// ASISTENCIA CAPTURADA DE UNA SESIÓN — definición única del sistema.
//
// Recordatorio de nombres: en pantalla, «sesión» es el modelo `Clase` y
// «fecha» es el modelo `Sesion`. Aquí se habla del modelo `Sesion`, que es la
// fila que tiene fecha y asistencia.
//
// ── El defecto ──────────────────────────────────────────────────────────────
// El dashboard mostraba «Sesiones impartidas N/M» contando como impartidas solo
// las sesiones con `ResumenSesion`, es decir los totales agregados que
// únicamente entran importando el Excel del organizador (o con
// scripts/cargar-2026.mjs). Crear la sesión en la aplicación, ponerle fecha y
// pasar lista no genera ningún `ResumenSesion`, así que una edición capturada
// entera desde la app salía en «0/7» y nada de lo que se hacía en pantalla
// movía ese número. QA lo dijo exacto: «no sé qué activa las sesiones».
//
// ── Qué quedó en su lugar ───────────────────────────────────────────────────
// Dos métricas separadas, porque eran dos preguntas distintas metidas en una:
//
//   «Sesiones registradas»  — cuántas sesiones tiene la edición. Un conteo, sin
//        fracción: una sesión cuenta desde que se crea, porque el flujo real es
//        que el domingo se carga lo que se impartió el sábado. No hay fracción
//        porque `Edicion` NO guarda ningún total de sesiones planeadas: el
//        denominador sería el propio total y la fracción daría 100% siempre,
//        que es justo un número que no informa de nada.
//
//   «Asistencia capturada» — N de esas sesiones tienen asistencia registrada.
//        Esta SÍ es fracción, y es la única que se mueve: le dice al
//        coordinador qué trabajo le falta.
//
// La fecha de la sesión ya no decide nada en estos cálculos.
//
// ── Qué cuenta como capturada ───────────────────────────────────────────────
// Que tenga asistencia registrada, venga de donde venga: la lista pasada en la
// aplicación (`Asistencia` con `presente`) o los totales importados
// (`ResumenSesion`). Antes solo contaba la segunda, y ese era el fallo.
//
// ── Precedencia cuando hay ambas fuentes ────────────────────────────────────
// Manda el agregado. Es el conteo que el organizador cerró a mano e incluye
// acompañantes y público que no está inscrito, mientras que la lista individual
// solo puede ver a los niños inscritos en la edición. Gracias a esta
// precedencia, los números de asistencia de las ediciones ya cerradas salen
// idénticos a los de antes del arreglo.
// ─────────────────────────────────────────────────────────────────────────────

import type { Nivel } from "@/lib/importacion/texto";

/**
 * Filtro de Prisma equivalente a `asistenciaDeSesion(...) !== null`, para los
 * conteos que no necesitan traerse las filas. Mira las DOS fuentes: filtrar
 * solo por `resumen` era el defecto original. Si cambia la definición, cambia
 * aquí y en `asistenciaDeSesion` a la vez.
 */
export const SESION_CAPTURADA: {
  OR: ({ resumen: { isNot: null } } | { asistencias: { some: { presente: boolean } } })[];
} = {
  OR: [
    { resumen: { isNot: null } },
    { asistencias: { some: { presente: true } } },
  ],
};

/**
 * `_count` de Prisma para el número que se enseña con la etiqueta
 * «asistentes» (las tarjetas del panel de asistencia y la página de la sesión).
 *
 * El filtro NO es decorativo. `Asistencia` guarda también a los ausentes:
 * marcar ausente a un niño no borra su fila, le pone `presente = false` (ver
 * el modelo en schema.prisma). Un `_count` pelado cuenta filas, así que
 * marcar a alguien como ausente SUMABA uno al contador de fuera mientras la
 * lista de dentro —que sí filtra— restaba uno. El coordinador lo vio como
 * «por fuera 7 y por dentro 3», y dio por perdida una lista que estaba bien
 * guardada.
 *
 * Que sea una constante y no un literal repetido es justamente para que las
 * dos pantallas no puedan volver a contar cosas distintas.
 *
 * OJO: esto es para CONTAR ASISTENTES. Para «cuántos registros se perderían
 * al borrar» hay que contar las filas, ausentes incluidos — eso lo hace
 * `contarArrastreDeClase` y ahí un filtro por presente sería el error.
 */
export const CONTEO_PRESENTES = {
  select: { asistencias: { where: { presente: true } } },
} as const;

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
   * Acompañantes: cuántas mamás y cuántos papás fueron a esta fecha.
   *
   * Salen de `Sesion.acompanantesMamas` / `acompanantesPapas`, que es lo que se
   * captura al pasar lista, y si esos campos están en NULL —toda fecha
   * importada— del agregado del Excel. Antes solo existía la segunda fuente, y
   * por eso el tablero decía «Acompañantes 0 · 0 mamás · 0 papás» en cuanto una
   * edición se capturaba en la aplicación: el dato no existía.
   *
   * OJO: no son una lista de personas. Quién acompaña a CADA niño ese año es
   * otra cosa y vive en `Acompanante` ligado a la `Inscripcion`.
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
  /**
   * Conteo de adultos capturado al pasar lista. `null` (o ausente) significa
   * «nadie los contó», y entonces manda el agregado importado; 0 significa «no
   * vino ninguno» y es un dato tan bueno como cualquier otro.
   *
   * Opcionales en el tipo para que una consulta que no los necesite —o una
   * prueba antigua— siga compilando sin arrastrarlos.
   */
  acompanantesMamas?: number | null;
  acompanantesPapas?: number | null;
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
 * que es exactamente lo que significa «sin capturar».
 */
export function asistenciaDeSesion(
  sesion: SesionConAsistencia,
): AsistenciaDeSesion | null {
  // Los acompañantes se resuelven aparte de los niños, y a propósito.
  //
  // Para los NIÑOS manda el agregado del Excel: el organizador contó también al
  // público que no está inscrito, y la lista de la aplicación solo ve a los
  // inscritos (ver «Precedencia» arriba). Para los ADULTOS manda lo que alguien
  // contó en la aplicación, porque `ResumenSesion.mamas` y `.papas` son `Int
  // @default(0)` y valen 0 en casi todas las filas importadas —la hoja del
  // organizador no siempre llevaba esas columnas—. Un 0 que nadie escribió no
  // puede tapar un 4 que alguien contó de pie en la sesión.
  //
  // Las fechas ya importadas tienen los dos campos en NULL, así que siguen
  // dando exactamente los números de antes del cambio.
  const mamas = sesion.acompanantesMamas ?? sesion.resumen?.mamas ?? 0;
  const papas = sesion.acompanantesPapas ?? sesion.resumen?.papas ?? 0;

  const r = sesion.resumen;
  if (r) {
    return {
      ninas: r.ninas,
      ninos: r.ninos,
      total: r.total,
      mamas,
      papas,
      preescolar: r.preescolar,
      primaria: r.primaria,
      secundaria: r.secundaria,
      mediaSuperior: r.mediaSuperior,
      porEdad: (r.porEdad ?? {}) as Record<string, number>,
      origen: "AGREGADA",
    };
  }

  // Contar adultos NO es pasar lista: una fecha en la que solo se apuntó «4
  // mamás» sigue sin capturar, y la tarjeta «Asistencia capturada» tiene que
  // seguir diciéndole al coordinador que le falta.
  const lista = sesion.asistencias ?? [];
  if (lista.length === 0) return null;

  const a: AsistenciaDeSesion = {
    ninas: 0,
    ninos: 0,
    // Los adultos NO entran en el total: el total son los niños presentes y es
    // el que alimenta promedio, pico y tendencia. Mezclarlos inflaría la
    // asistencia del programa con gente que no está inscrita.
    total: lista.length,
    mamas,
    papas,
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
