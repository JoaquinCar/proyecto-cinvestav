import type { Nivel } from "@/lib/importacion/texto";

// ─────────────────────────────────────────────────────────────────────────────
// Catálogo de grados que se ofrecen al capturar a un participante.
//
// Hasta ahora el formulario de registro solo ofrecía los seis de primaria, y
// eso dejaba fuera a niños que YA están en la base: en 2026 hay cuatro de
// preescolar y cinco de secundaria, todos entrados por el importador de Excel
// porque a mano no se podían capturar.
//
// Las etiquetas están agrupadas por nivel a propósito. El nivel NO se guarda
// desde el formulario: se deriva del grado con `derivarNivel`, que es la misma
// función que homologa los datos que entran por Excel. Agrupar aquí permite
// comprobar en una prueba que cada etiqueta cae donde debe — una etiqueta que
// `derivarNivel` no reconociera se contaría en el nivel equivocado en las
// gráficas, sin error visible.
//
// Ojo con inventar grafías nuevas: cada cadena de aquí pasa por `derivarNivel`,
// así que tiene que contener la palabra que lo identifica (preescolar,
// primaria, secundaria, preparatoria, universidad, no estudia).
// ─────────────────────────────────────────────────────────────────────────────

export const GRADOS_POR_NIVEL = {
  PREESCOLAR: [
    "1° preescolar",
    "2° preescolar",
    "3° preescolar",
  ],
  PRIMARIA: [
    "1° primaria",
    "2° primaria",
    "3° primaria",
    "4° primaria",
    "5° primaria",
    "6° primaria",
  ],
  SECUNDARIA: [
    "1° secundaria",
    "2° secundaria",
    "3° secundaria",
  ],
  MEDIA_SUPERIOR: [
    "1° preparatoria",
    "2° preparatoria",
    "3° preparatoria",
  ],
  UNIVERSIDAD: [
    "Universidad",
  ],
  SIN_ESCUELA: [
    "No estudia",
  ],
} as const satisfies Record<Nivel, readonly string[]>;

/** Cómo se titula cada grupo en el desplegable. */
export const NIVEL_GRUPO_LABEL: Record<Nivel, string> = {
  PREESCOLAR:     "Preescolar",
  PRIMARIA:       "Primaria",
  SECUNDARIA:     "Secundaria",
  MEDIA_SUPERIOR: "Preparatoria",
  UNIVERSIDAD:    "Superior",
  SIN_ESCUELA:    "Sin escuela",
};

/** Orden en que se muestran los grupos: de menor a mayor escolaridad. */
export const NIVELES_ORDENADOS = Object.keys(GRADOS_POR_NIVEL) as Nivel[];

/** Todas las etiquetas, en el mismo orden en que se agrupan. */
export const GRADOS: readonly string[] =
  Object.values(GRADOS_POR_NIVEL).flat();
