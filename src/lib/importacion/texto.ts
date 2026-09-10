// Utilidades de normalización compartidas por el importador de Excel.
// Todo aquí es puro (sin Prisma, sin red) para poder probarlo con vitest.

/** Quita acentos, colapsa espacios y pasa a minúsculas. */
export function normalizar(valor: unknown): string {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Normaliza un encabezado de columna: sin acentos, sin signos y en minúsculas.
 * "Educación Pre Escolar" → "educacion pre escolar"; "Nombre(s)" → "nombre s".
 */
export function normalizarEncabezado(valor: unknown): string {
  return normalizar(valor)
    .replace(/[^a-z0-9ñ ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Clave de identidad de un participante: nombre + apellidos normalizados. */
export function claveParticipante(nombre: string, apellidos: string): string {
  return `${normalizar(nombre)}|${normalizar(apellidos)}`;
}

/** Texto de celda ya recortado; "" cuando la celda está vacía. */
export function textoCelda(valor: unknown): string {
  if (valor === null || valor === undefined) return "";
  if (valor instanceof Date) return valor.toISOString();
  return String(valor).trim();
}

/**
 * Marcadores de «aquí no hay dato» que la gente escribe en las hojas. El export
 * de esta misma app usa «—», así que sin esto un archivo exportado y vuelto a
 * importar guardaría literalmente «—» como correo o como nivel escolar.
 */
const VACIOS = new Set(["", "-", "--", "---", "—", "–", ".", "n/a", "na", "s/d", "sin dato", "ninguno"]);

export function esCeldaVacia(valor: unknown): boolean {
  return VACIOS.has(normalizar(textoCelda(valor)));
}

/** Texto de celda tratando los marcadores de vacío («—», «-», «N/A») como "". */
export function textoOpcional(valor: unknown): string {
  return esCeldaVacia(valor) ? "" : textoCelda(valor);
}

// ── Números ───────────────────────────────────────────────────────────────────

export type Conversion<T> =
  | { ok: true; valor: T }
  | { ok: false; mensaje: string };

/**
 * Convierte una celda a entero. Acepta "10", 10, "10 años", " 10 ".
 * Rechaza texto sin dígitos ("diez") con un mensaje citando lo que dice la celda.
 */
export function aEntero(valor: unknown, columna: string): Conversion<number> {
  const texto = textoCelda(valor);
  if (texto === "") {
    return { ok: false, mensaje: `la columna «${columna}» está vacía, se esperaba un número` };
  }
  if (typeof valor === "number" && Number.isFinite(valor)) {
    if (!Number.isInteger(valor)) {
      return {
        ok: false,
        mensaje: `la columna «${columna}» dice «${texto}», se esperaba un número entero`,
      };
    }
    return { ok: true, valor };
  }
  const limpio = texto.replace(/[^\d.-]/g, "");
  if (limpio === "" || !/\d/.test(limpio)) {
    return { ok: false, mensaje: `la columna «${columna}» dice «${texto}», se esperaba un número` };
  }
  const n = Number(limpio);
  if (!Number.isFinite(n)) {
    return { ok: false, mensaje: `la columna «${columna}» dice «${texto}», se esperaba un número` };
  }
  if (!Number.isInteger(n)) {
    return {
      ok: false,
      mensaje: `la columna «${columna}» dice «${texto}», se esperaba un número entero`,
    };
  }
  return { ok: true, valor: n };
}

/** Entero opcional: celda vacía → 0, sin error. */
export function aEnteroOpcional(valor: unknown, columna: string): Conversion<number> {
  if (esCeldaVacia(valor)) return { ok: true, valor: 0 };
  return aEntero(valor, columna);
}

// ── Género ────────────────────────────────────────────────────────────────────

const GENEROS: Record<string, "FEMENINO" | "MASCULINO"> = {
  f: "FEMENINO",
  fem: "FEMENINO",
  femenino: "FEMENINO",
  femenina: "FEMENINO",
  nina: "FEMENINO",
  nena: "FEMENINO",
  mujer: "FEMENINO",
  h: "MASCULINO",
  masc: "MASCULINO",
  masculino: "MASCULINO",
  masculina: "MASCULINO",
  nino: "MASCULINO",
  nene: "MASCULINO",
  hombre: "MASCULINO",
  varon: "MASCULINO",
};

/**
 * "Niña"/"F"/"FEMENINO" → FEMENINO. Celda vacía → null (permitido).
 * Ojo: "M" es ambiguo en español (Mujer / Masculino); se rechaza a propósito.
 */
export function aGenero(
  valor: unknown,
  columna = "Género",
): Conversion<"FEMENINO" | "MASCULINO" | null> {
  const texto = textoOpcional(valor);
  if (texto === "") return { ok: true, valor: null };
  const clave = normalizar(texto).replace(/[^a-z0-9]/g, "");
  if (clave === "m") {
    return {
      ok: false,
      mensaje: `la columna «${columna}» dice «${texto}»: «M» es ambiguo (¿Mujer o Masculino?). Escribe «Niña» o «Niño»`,
    };
  }
  const g = GENEROS[clave];
  if (!g) {
    return {
      ok: false,
      mensaje: `la columna «${columna}» dice «${texto}», se esperaba «Niña» o «Niño»`,
    };
  }
  return { ok: true, valor: g };
}

// ── Nivel escolar ─────────────────────────────────────────────────────────────

export type Nivel =
  | "PREESCOLAR"
  | "PRIMARIA"
  | "SECUNDARIA"
  | "MEDIA_SUPERIOR"
  | "SIN_ESCUELA";

const NIVELES: Record<string, Nivel> = {
  preescolar: "PREESCOLAR",
  "pre escolar": "PREESCOLAR",
  kinder: "PREESCOLAR",
  primaria: "PRIMARIA",
  secundaria: "SECUNDARIA",
  "media superior": "MEDIA_SUPERIOR",
  bachillerato: "MEDIA_SUPERIOR",
  preparatoria: "MEDIA_SUPERIOR",
  prepa: "MEDIA_SUPERIOR",
  "sin escuela": "SIN_ESCUELA",
  ninguno: "SIN_ESCUELA",
  "no va a escuela": "SIN_ESCUELA",
};

export function aNivel(valor: unknown, columna = "Nivel"): Conversion<Nivel | null> {
  const texto = textoOpcional(valor);
  if (texto === "") return { ok: true, valor: null };
  const clave = normalizar(texto).replace(/_/g, " ");
  const n = NIVELES[clave] ?? NIVELES[clave.replace(/\s+/g, " ")];
  if (!n) {
    return {
      ok: false,
      mensaje: `la columna «${columna}» dice «${texto}», se esperaba Preescolar, Primaria, Secundaria, Media superior o Sin escuela`,
    };
  }
  return { ok: true, valor: n };
}

/**
 * Deriva el nivel a partir de grado + escuela + edad.
 * Misma heurística que scripts/normalizar.mjs, para que los datos ya cargados
 * y los que entren por Excel queden homologados.
 */
export function derivarNivel(grado: string, escuela: string, edad: number): Nivel {
  const crudo = `${grado} ${escuela}`;
  const t = normalizar(crudo);
  if (/no va a escuela|no asiste/.test(t)) return "SIN_ESCUELA";
  // El grado manda sobre la escuela: «Preescolar» + «Sin escuela» es preescolar.
  if (/preescolar|pre escolar|kinder|preesc/.test(t)) return "PREESCOLAR";
  if (/semestre|prepa|cecyte|bachill|media superior/.test(t)) return "MEDIA_SUPERIOR";
  if (/secundaria|sec\.|secund|esc\. sec/.test(t)) return "SECUNDARIA";
  if (/sin escuela/.test(t)) return "SIN_ESCUELA";
  if (/primaria|grado|°|º/.test(crudo.toLowerCase())) {
    return edad >= 12 ? "SECUNDARIA" : "PRIMARIA";
  }
  if (edad < 6) return "PREESCOLAR";
  if (edad <= 11) return "PRIMARIA";
  if (edad <= 14) return "SECUNDARIA";
  return "MEDIA_SUPERIOR";
}

// ── Fechas ────────────────────────────────────────────────────────────────────

const MESES: Record<string, number> = {
  enero: 1, ene: 1,
  febrero: 2, feb: 2,
  marzo: 3, mar: 3,
  abril: 4, abr: 4,
  mayo: 5, may: 5,
  junio: 6, jun: 6,
  julio: 7, jul: 7,
  agosto: 8, ago: 8,
  septiembre: 9, setiembre: 9, sep: 9, sept: 9,
  octubre: 10, oct: 10,
  noviembre: 11, nov: 11,
  diciembre: 12, dic: 12,
};

/**
 * Construye la fecha a mediodía UTC, igual que scripts/parse-asistencia.mjs,
 * para que ningún huso horario mueva el día.
 */
export function fechaUTC(anio: number, mes: number, dia: number): Date {
  return new Date(Date.UTC(anio, mes - 1, dia, 12, 0, 0));
}

function fechaValida(anio: number, mes: number, dia: number): boolean {
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return false;
  const d = fechaUTC(anio, mes, dia);
  return d.getUTCMonth() === mes - 1 && d.getUTCDate() === dia;
}

/**
 * Acepta los formatos que aparecen en los archivos reales del organizador:
 *  - "24 de enero" (sin año → se usa `anioPorDefecto`, el año de la edición)
 *  - "24 de enero de 2026"
 *  - fecha nativa de Excel (número de serie o Date)
 *  - "2026-01-24" y "24/01/2026"
 */
export function aFecha(
  valor: unknown,
  columna: string,
  anioPorDefecto: number,
): Conversion<Date> {
  const texto = textoCelda(valor);
  if (texto === "") {
    return { ok: false, mensaje: `la columna «${columna}» está vacía, se esperaba una fecha` };
  }

  if (valor instanceof Date && !Number.isNaN(valor.getTime())) {
    return {
      ok: true,
      valor: fechaUTC(valor.getFullYear(), valor.getMonth() + 1, valor.getDate()),
    };
  }

  // Número de serie de Excel (días desde 1899-12-30).
  if (typeof valor === "number" && Number.isFinite(valor) && valor > 0 && valor < 100000) {
    const base = Date.UTC(1899, 11, 30);
    const d = new Date(base + Math.round(valor) * 86400000);
    return {
      ok: true,
      valor: fechaUTC(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()),
    };
  }

  const iso = texto.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    const a = Number(iso[1]);
    const m = Number(iso[2]);
    const d = Number(iso[3]);
    if (fechaValida(a, m, d)) return { ok: true, valor: fechaUTC(a, m, d) };
    return { ok: false, mensaje: `la columna «${columna}» dice «${texto}», esa fecha no existe` };
  }

  const dmy = texto.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (dmy) {
    const d = Number(dmy[1]);
    const m = Number(dmy[2]);
    let a = Number(dmy[3]);
    if (a < 100) a += 2000;
    if (fechaValida(a, m, d)) return { ok: true, valor: fechaUTC(a, m, d) };
    return { ok: false, mensaje: `la columna «${columna}» dice «${texto}», esa fecha no existe` };
  }

  const largo = normalizar(texto).match(
    /^(\d{1,2})\s*(?:de\s*)?([a-zñ]+)\.?(?:\s*(?:de\s*|del\s*)?(\d{4}))?$/,
  );
  if (largo) {
    const d = Number(largo[1]);
    const m = MESES[largo[2]];
    const a = largo[3] ? Number(largo[3]) : anioPorDefecto;
    if (m && fechaValida(a, m, d)) return { ok: true, valor: fechaUTC(a, m, d) };
  }

  return {
    ok: false,
    mensaje: `la columna «${columna}» dice «${texto}», se esperaba una fecha (por ejemplo «24 de enero» o «24/01/${anioPorDefecto}»)`,
  };
}

/** Clave día para comparar fechas sin arrastrar horas: "2026-01-24". */
export function claveFecha(fecha: Date): string {
  const a = fecha.getUTCFullYear();
  const m = String(fecha.getUTCMonth() + 1).padStart(2, "0");
  const d = String(fecha.getUTCDate()).padStart(2, "0");
  return `${a}-${m}-${d}`;
}

// ── Asistencia (marca de presencia) ───────────────────────────────────────────

const PRESENTE = new Set([
  "x", "si", "s", "1", "p", "presente", "v", "✓", "✔", "asistio", "true",
]);
const AUSENTE = new Set([
  "", "-", "--", "0", "no", "n", "f", "falta", "ausente", "false",
]);

/** "X" → presente, vacío/"-"/"0" → ausente, cualquier otra cosa → error. */
export function aPresencia(valor: unknown, columna: string): Conversion<boolean> {
  const texto = textoCelda(valor);
  const clave = normalizar(texto);
  if (PRESENTE.has(clave)) return { ok: true, valor: true };
  if (AUSENTE.has(clave)) return { ok: true, valor: false };
  return {
    ok: false,
    mensaje: `la columna «${columna}» dice «${texto}», se esperaba «X» (asistió) o vacío (no asistió)`,
  };
}

/** Neutraliza fórmulas al escribir texto en un .xlsx (=, +, -, @). */
export function celdaSegura(valor: string): string {
  return /^[=+\-@\t\r]/.test(valor) ? `'${valor}` : valor;
}
