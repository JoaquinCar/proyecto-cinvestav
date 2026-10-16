// ─────────────────────────────────────────────────────────────────────────────
// CIUDAD DE PROCEDENCIA DEL PARTICIPANTE
//
// El coordinador pidió el campo con un motivo explícito: «luego se usa en las
// estadísticas». La pregunta que quiere responder es DE DÓNDE VIENEN LOS NIÑOS,
// y esa pregunta solo tiene respuesta si la misma localidad se escribe siempre
// igual. «Mérida», «merida», «MERIDA» y «Mérida, Yuc.» son una sola ciudad: si
// entran como cuatro, la gráfica no dice nada.
//
// ── Por qué ni lista cerrada ni texto libre ─────────────────────────────────
//
// Un `<select>` cerrado sería el dato más limpio posible, pero perdería a quien
// no esté en el catálogo —un niño de visita desde Campeche o desde una comisaría
// que nadie listó— y quien captura no tendría dónde ponerlo. Un texto libre a
// secas parte la estadística en tantas barras como grafías.
//
// Lo que hay es lo mismo que ya se hace con `grado`: SE SUGIERE EL CATÁLOGO
// (datalist) Y SE CANONIZA LO QUE SE ESCRIBA. Si lo escrito coincide con una
// entrada del catálogo —ignorando acentos, mayúsculas, puntuación y el estado
// o el país añadidos al final—, se guarda con la grafía del catálogo. Si no
// coincide, se guarda tal cual, recortado y capitalizado, porque perder el dato
// sería peor que tenerlo suelto.
//
// ── Por qué el campo es OPCIONAL ────────────────────────────────────────────
//
// No se exige en ninguna capa (la columna ya admitía NULL). Dos motivos del
// terreno: en los respaldos hay participantes sin ciudad, y la carga la hace una
// persona a mano, sesión por sesión. Un campo obligatorio que no se puede
// rellenar la deja atascada a media captura. En la estadística, quien no la
// tenga aparece agrupado como «Sin especificar», que es información honesta;
// inventarle «Mérida» no lo sería.
// ─────────────────────────────────────────────────────────────────────────────

import { esCeldaVacia, normalizar, textoCelda } from "@/lib/importacion/texto";

/** Lo que admite la columna `Participante.ciudad`. */
export const LARGO_MAXIMO_CIUDAD = 100;

/**
 * Catálogo de sugerencias: Mérida, su zona metropolitana y las cabeceras del
 * interior de las que llegan niños al programa. Mérida va primera porque es de
 * donde viene la inmensa mayoría y así queda a un clic.
 *
 * NO es una lista cerrada: solo sugiere y fija la grafía buena. Añadir una
 * localidad aquí hace dos cosas a la vez — la ofrece en los formularios y
 * convierte en ella todas sus grafías sueltas.
 */
export const CIUDADES = [
  "Mérida",
  "Kanasín",
  "Umán",
  "Progreso",
  "Conkal",
  "Ucú",
  "Tixpéhual",
  "Tixkokob",
  "Hunucmá",
  "Acanceh",
  "Seyé",
  "Timucuy",
  "Tecoh",
  "Abalá",
  "Baca",
  "Mocochá",
  "Ixil",
  "Yaxkukul",
  "Chocholá",
  "Chicxulub Pueblo",
  "Chicxulub Puerto",
  "Dzemul",
  "Dzidzantún",
  "Telchac Pueblo",
  "Telchac Puerto",
  "Sinanché",
  "Motul",
  "Izamal",
  "Hoctún",
  "Tahmek",
  "Kantunil",
  "Sotuta",
  "Homún",
  "Huhí",
  "Cuzamá",
  "Maxcanú",
  "Halachó",
  "Opichén",
  "Muna",
  "Ticul",
  "Oxkutzcab",
  "Tekax",
  "Peto",
  "Tzucacab",
  "Valladolid",
  "Tizimín",
  "Espita",
  "Temozón",
  "Celestún",
  "Kinchil",
  "Tetiz",
] as const satisfies readonly string[];

/**
 * Grafías sueltas que no son solo un acento o una mayúscula de diferencia y que
 * aparecen en los datos reales. Las claves ya vienen normalizadas (sin acentos,
 * en minúsculas y sin puntuación).
 *
 * Aquí NO se agrupan localidades distintas: las comisarías de Mérida (Caucel,
 * Cholul, Komchén…) se dejan como las escriba quien captura. Decidir que son
 * «Mérida» es una decisión del coordinador sobre su propio análisis, no del
 * código.
 */
const ALIAS: Record<string, string> = {
  "progreso de castro": "Progreso",
  "izamal pueblo magico": "Izamal",
  "valladolid pueblo magico": "Valladolid",
  "ciudad de mexico": "Ciudad de México",
  cdmx: "Ciudad de México",
  df: "Ciudad de México",
};

/**
 * Coletillas de estado y país que la gente añade al final. Se quitan palabra a
 * palabra: «Mérida, Yucatán, México» tiene que llegar a «Mérida». Nunca se
 * quita la última palabra que queda: «Yucatán» a secas no es una coletilla,
 * es lo único que se escribió.
 */
const COLETILLAS = new Set(["mexico", "mex", "mx", "yucatan", "yuc"]);

/** Palabras que en español van en minúscula dentro de un nombre propio. */
const CONECTORES = new Set(["de", "del", "la", "las", "los", "el", "y"]);

/** Clave de búsqueda: sin acentos, sin puntuación y en minúsculas. */
function clave(texto: string): string {
  return normalizar(texto)
    .replace(/[^a-z0-9ñ ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const POR_CLAVE = new Map<string, string>(
  CIUDADES.map((ciudad) => [clave(ciudad), ciudad]),
);

/**
 * Parte el texto en palabras conservando los acentos tal como se escribieron y
 * tirando la puntuación de los bordes: «Mérida, Yuc.» → ["Mérida", "Yuc"].
 */
function palabras(valor: string): string[] {
  return valor
    .split(/[\s,;./]+/)
    .map((p) => p.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ""))
    .filter((p) => p !== "");
}

/** Quita las coletillas de estado y país del final, sin vaciar el texto. */
function sinColetillas(partes: string[]): string[] {
  const resto = [...partes];
  while (resto.length > 1 && COLETILLAS.has(clave(resto[resto.length - 1]))) {
    resto.pop();
  }
  return resto;
}

/** «CIUDAD DEL CARMEN» → «Ciudad del Carmen». Respeta los acentos escritos. */
function capitalizar(valor: string): string {
  return valor
    .split(" ")
    .map((palabra, i) => {
      const minuscula = palabra.toLocaleLowerCase("es-MX");
      if (i > 0 && CONECTORES.has(clave(minuscula))) return minuscula;
      return minuscula.charAt(0).toLocaleUpperCase("es-MX") + minuscula.slice(1);
    })
    .join(" ");
}

/**
 * Deja la ciudad lista para guardarse, o `null` si no se capturó.
 *
 * Es el ÚNICO sitio donde se decide cómo se escribe una ciudad. Lo usan el
 * esquema de Zod (alta y edición a mano), el importador de Excel y el desglose
 * por ciudad de las estadísticas — este último para que también salgan juntas
 * las grafías que ya están guardadas en los respaldos, sin tener que reescribir
 * ninguna fila.
 */
export function normalizarCiudad(valor: unknown): string | null {
  const texto = textoCelda(valor);
  if (texto === "" || esCeldaVacia(texto)) return null;

  const partes = sinColetillas(palabras(texto));
  if (partes.length === 0) return null;

  const base = clave(partes.join(" "));
  if (base === "") return null;

  const delCatalogo = POR_CLAVE.get(base) ?? ALIAS[base];
  if (delCatalogo) return delCatalogo;

  // Fuera del catálogo se respeta lo escrito —nadie más sabe dónde van sus
  // acentos—, pero sin los espacios de más, sin la coletilla del estado y con
  // una capitalización estable para que no se parta en varias barras.
  return capitalizar(partes.join(" ")).slice(0, LARGO_MAXIMO_CIUDAD).trim();
}
