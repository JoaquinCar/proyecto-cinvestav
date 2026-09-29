// Lectura y validación de los .xlsx de importación.
//
// Nada de este módulo toca la base de datos: entra un Buffer y sale una lista de
// filas normalizadas más las incidencias, cada una con su número de fila REAL de
// Excel (el que el organizador ve en la barra lateral de su hoja).

import * as XLSX from "xlsx";
import {
  COLUMNAS_IGNORADAS_ASISTENCIA,
  EDAD_MAX_COLUMNA,
  EDAD_MIN_COLUMNA,
  definicionesDe,
  encabezadoDe,
  indiceDeAlias,
  type TipoImportacion,
} from "./columnas";
import {
  aEntero,
  aEnteroOpcional,
  aFecha,
  aGenero,
  aNivel,
  aPresencia,
  claveFecha,
  derivarNivel,
  normalizar,
  normalizarEncabezado,
  textoCelda,
  textoOpcional,
  type Conversion,
} from "./texto";
import {
  FILAS_MAXIMAS,
  filaAsistenciaSchema,
  filaParticipanteSchema,
  filaSesionSchema,
  type FilaAsistencia,
  type FilaParticipante,
  type FilaSesion,
} from "@/lib/schemas/importacion.schema";
import type { ZodType } from "zod";

// ── Tipos de salida ───────────────────────────────────────────────────────────

export interface Incidencia {
  /** Número de fila de Excel (1-based). null = problema de todo el archivo. */
  fila: number | null;
  mensaje: string;
}

export interface FilaLeida<T> {
  fila: number;
  datos: T;
}

export interface ColumnaSesionDetectada {
  /** Índice de columna en la hoja. */
  indice: number;
  /** Encabezado tal cual lo escribió el organizador. */
  etiqueta: string;
  /** Fecha si el encabezado era una fecha; null si era el nombre de la clase. */
  fecha: Date | null;
}

export interface ResultadoParseo<T> {
  tipo: TipoImportacion;
  hoja: string;
  filaEncabezado: number;
  columnasReconocidas: string[];
  columnasIgnoradas: string[];
  columnasFaltantes: string[];
  /** Solo para asistencia nominal: las columnas que son sesiones. */
  columnasSesion: ColumnaSesionDetectada[];
  filas: FilaLeida<T>[];
  errores: Incidencia[];
  avisos: Incidencia[];
}

/** Falla que impide siquiera abrir el archivo. */
export class ErrorArchivo extends Error {}

// ── Lectura cruda de la hoja ──────────────────────────────────────────────────

interface Hoja {
  nombre: string;
  /** Matriz de celdas. */
  filas: unknown[][];
  /** Fila de Excel (1-based) que corresponde a filas[0]. */
  origen: number;
}

function leerHoja(archivo: Buffer | ArrayBuffer): Hoja {
  let libro: XLSX.WorkBook;
  try {
    libro = XLSX.read(archivo, { type: "buffer", cellDates: true, raw: false });
  } catch {
    throw new ErrorArchivo(
      "No se pudo leer el archivo. Debe ser una hoja de cálculo .xlsx o .xls válida.",
    );
  }
  const nombre = libro.SheetNames[0];
  if (!nombre) throw new ErrorArchivo("El archivo no tiene ninguna hoja.");
  const hoja = libro.Sheets[nombre];
  const ref = hoja["!ref"];
  if (!ref) throw new ErrorArchivo(`La hoja «${nombre}» está vacía.`);
  const rango = XLSX.utils.decode_range(ref);
  const filas = XLSX.utils.sheet_to_json<unknown[]>(hoja, {
    header: 1,
    defval: "",
    blankrows: true,
    raw: true,
  });
  return { nombre, filas, origen: rango.s.r + 1 };
}

/** Todas las celdas de la fila están vacías. */
function filaVacia(fila: unknown[] | undefined): boolean {
  if (!fila) return true;
  return fila.every((c) => textoCelda(c) === "");
}

// ── Localización del encabezado ───────────────────────────────────────────────

const FILAS_A_INSPECCIONAR = 15;

function localizarEncabezado(
  hoja: Hoja,
  cumple: (etiquetas: string[]) => boolean,
): number {
  const tope = Math.min(hoja.filas.length, FILAS_A_INSPECCIONAR);
  for (let i = 0; i < tope; i++) {
    const etiquetas = (hoja.filas[i] ?? []).map((c) => normalizarEncabezado(c));
    if (cumple(etiquetas)) return i;
  }
  return -1;
}

/**
 * Combina el encabezado de dos renglones del concentrado real: el renglón de
 * grupo («ASISTENCIA», «NIÑOS POR EDADES») va combinado sobre varias columnas y
 * el de abajo trae el nombre concreto. Regla: gana el de abajo; si está vacío,
 * se usa el de arriba.
 */
function fusionarEncabezados(principal: unknown[], secundaria: unknown[]): string[] {
  const ancho = Math.max(principal.length, secundaria.length);
  const salida: string[] = [];
  for (let c = 0; c < ancho; c++) {
    const abajo = textoCelda(secundaria[c]);
    salida.push(abajo !== "" ? abajo : textoCelda(principal[c]));
  }
  return salida;
}

interface MapeoColumnas {
  /** clave canónica → índice de columna. */
  indices: Map<string, number>;
  ignoradas: string[];
  avisos: Incidencia[];
  /** Encabezados crudos por índice. */
  crudos: string[];
}

function mapearColumnas(
  tipo: TipoImportacion,
  encabezados: string[],
  filaEncabezado: number,
  ignorables?: (normalizado: string) => boolean,
): MapeoColumnas {
  const alias = indiceDeAlias(tipo);
  const indices = new Map<string, number>();
  const ignoradas: string[] = [];
  const avisos: Incidencia[] = [];

  encabezados.forEach((crudo, i) => {
    const norm = normalizarEncabezado(crudo);
    if (norm === "") return;
    const clave = alias.get(norm);
    if (!clave) {
      if (!ignorables?.(norm)) ignoradas.push(crudo.trim());
      return;
    }
    if (indices.has(clave)) {
      avisos.push({
        fila: filaEncabezado,
        mensaje: `La columna «${crudo.trim()}» aparece más de una vez; se usa la primera y se ignora la repetida.`,
      });
      return;
    }
    indices.set(clave, i);
  });

  return { indices, ignoradas, avisos, crudos: encabezados };
}

function faltantes(tipo: TipoImportacion, indices: Map<string, number>): string[] {
  return definicionesDe(tipo)
    .filter((c) => c.obligatoria && !indices.has(c.clave))
    .map((c) => c.encabezado);
}

function errorDeColumnasFaltantes(
  faltan: string[],
  encabezados: string[],
): Incidencia {
  const traidas = encabezados.map((e) => e.trim()).filter(Boolean);
  const lista = faltan.map((f) => `«${f}»`).join(", ");
  return {
    fila: null,
    mensaje:
      `Falta${faltan.length > 1 ? "n" : ""} la${faltan.length > 1 ? "s" : ""} columna${
        faltan.length > 1 ? "s" : ""
      } obligatoria${faltan.length > 1 ? "s" : ""} ${lista}. ` +
      `El archivo trae: ${traidas.length ? traidas.join(", ") : "(ninguna)"}.`,
  };
}

// ── Validación con Zod, con mensajes por columna ──────────────────────────────

function validarConZod<T>(
  esquema: ZodType<T>,
  tipo: TipoImportacion,
  fila: number,
  candidato: unknown,
  errores: Incidencia[],
): T | null {
  const r = esquema.safeParse(candidato);
  if (r.success) return r.data;
  for (const issue of r.error.issues) {
    const clave = String(issue.path[0] ?? "");
    const columna = clave ? encabezadoDe(tipo, clave) : "";
    const prefijo = columna && columna !== clave ? `la columna «${columna}»: ` : "";
    errores.push({ fila, mensaje: `${prefijo}${issue.message}` });
  }
  return null;
}

/** Acumula el resultado de una conversión; devuelve null si falló. */
function tomar<T>(
  conv: Conversion<T>,
  fila: number,
  errores: Incidencia[],
): T | null {
  if (conv.ok) return conv.valor;
  errores.push({ fila, mensaje: conv.mensaje });
  return null;
}

// ── Tipo 1 · Participantes ────────────────────────────────────────────────────

export function parsearParticipantes(
  archivo: Buffer | ArrayBuffer,
): ResultadoParseo<FilaParticipante> {
  const hoja = leerHoja(archivo);
  const alias = indiceDeAlias("participantes");

  // Basta con reconocer «Nombre» o «Apellidos» para dar por bueno el renglón:
  // así, si falta una de las dos, el error dice qué columna falta en vez de
  // «no encontré encabezados».
  const idx = localizarEncabezado(hoja, (etiquetas) => {
    const claves = new Set(etiquetas.map((e) => alias.get(e)).filter(Boolean));
    return claves.has("nombre") || claves.has("apellidos");
  });

  const base: ResultadoParseo<FilaParticipante> = {
    tipo: "participantes",
    hoja: hoja.nombre,
    filaEncabezado: 0,
    columnasReconocidas: [],
    columnasIgnoradas: [],
    columnasFaltantes: [],
    columnasSesion: [],
    filas: [],
    errores: [],
    avisos: [],
  };

  if (idx === -1) {
    base.errores.push({
      fila: null,
      mensaje:
        "No se encontró el renglón de encabezados. La primera fila debe traer al menos las columnas «Nombre» y «Apellidos».",
    });
    return base;
  }

  const filaEncabezado = hoja.origen + idx;
  base.filaEncabezado = filaEncabezado;
  const encabezados = (hoja.filas[idx] ?? []).map((c) => textoCelda(c));
  const mapeo = mapearColumnas("participantes", encabezados, filaEncabezado, (n) =>
    ["#", "no", "num", "numero", "grupo", "participacion", "modalidad"].includes(n),
  );
  base.columnasIgnoradas = mapeo.ignoradas;
  base.avisos.push(...mapeo.avisos);
  base.columnasReconocidas = [...mapeo.indices.keys()].map((k) =>
    encabezadoDe("participantes", k),
  );

  const faltan = faltantes("participantes", mapeo.indices);
  if (faltan.length) {
    base.columnasFaltantes = faltan;
    base.errores.push(errorDeColumnasFaltantes(faltan, encabezados));
    return base;
  }

  const celda = (fila: unknown[], clave: string): unknown => {
    const i = mapeo.indices.get(clave);
    return i === undefined ? "" : fila[i];
  };

  for (let i = idx + 1; i < hoja.filas.length; i++) {
    const cruda = hoja.filas[i] ?? [];
    const numeroFila = hoja.origen + i;
    if (filaVacia(cruda)) continue;

    const nombre = textoCelda(celda(cruda, "nombre"));
    const apellidos = textoCelda(celda(cruda, "apellidos"));
    if (nombre === "" && apellidos === "") continue; // renglón decorativo o vacío

    if (base.filas.length >= FILAS_MAXIMAS) {
      base.errores.push({
        fila: numeroFila,
        mensaje: `El archivo supera el máximo de ${FILAS_MAXIMAS} filas por importación.`,
      });
      break;
    }

    const errores: Incidencia[] = [];

    const edad = tomar(aEntero(celda(cruda, "edad"), "Edad"), numeroFila, errores);
    const genero = tomar(aGenero(celda(cruda, "genero")), numeroFila, errores);
    const nivelExplicito = tomar(aNivel(celda(cruda, "nivel")), numeroFila, errores);

    if (errores.length) {
      base.errores.push(...errores);
      continue;
    }

    // «—», «-» y «N/A» cuentan como celda vacía: el propio export de la app usa
    // «—» para lo que no tiene dato, y no debe reimportarse como si fuera texto.
    const escuela = textoOpcional(celda(cruda, "escuela")) || "Sin escuela";
    const grado = textoOpcional(celda(cruda, "grado")) || "Sin especificar";
    const ciudad = textoOpcional(celda(cruda, "ciudad")) || "Mérida";
    const correo = textoOpcional(celda(cruda, "correo"));
    const telefono = textoOpcional(celda(cruda, "telefono"));

    const provistos = (
      ["edad", "genero", "grado", "nivel", "escuela", "ciudad", "correo", "telefono"] as const
    ).filter((clave) => textoOpcional(celda(cruda, clave)) !== "");

    const candidato = {
      nombre,
      apellidos,
      edad: edad as number,
      genero: genero ?? null,
      grado,
      nivel: nivelExplicito ?? derivarNivel(grado, escuela, edad as number),
      escuela,
      ciudad,
      correo,
      telefono,
      provistos: [...provistos],
    };

    const datos = validarConZod(
      filaParticipanteSchema,
      "participantes",
      numeroFila,
      candidato,
      base.errores,
    );
    if (datos) base.filas.push({ fila: numeroFila, datos });
  }

  if (base.filas.length === 0 && base.errores.length === 0) {
    base.errores.push({ fila: null, mensaje: "El archivo no trae ninguna fila con datos." });
  }
  return base;
}

// ── Tipo 2 · Sesiones y asistencia agregada ───────────────────────────────────

const RE_ORDEN = /^\s*(\d{1,2})\s*[.)-]\s*(.+)$/;

export function parsearSesiones(
  archivo: Buffer | ArrayBuffer,
  anioEdicion: number,
): ResultadoParseo<FilaSesion> {
  const hoja = leerHoja(archivo);
  const alias = indiceDeAlias("sesiones");

  const idx = localizarEncabezado(hoja, (etiquetas) =>
    etiquetas.some((e) => alias.get(e) === "sesion"),
  );

  const base: ResultadoParseo<FilaSesion> = {
    tipo: "sesiones",
    hoja: hoja.nombre,
    filaEncabezado: 0,
    columnasReconocidas: [],
    columnasIgnoradas: [],
    columnasFaltantes: [],
    columnasSesion: [],
    filas: [],
    errores: [],
    avisos: [],
  };

  if (idx === -1) {
    base.errores.push({
      fila: null,
      mensaje:
        "No se encontró el renglón de encabezados. Debe traer una columna «SESIÓN» (o «Tema») y una columna «FECHA».",
    });
    return base;
  }

  // El concentrado real usa dos renglones de encabezado (grupo + detalle).
  const siguiente = (hoja.filas[idx + 1] ?? []).map((c) => normalizarEncabezado(c));
  const dobleEncabezado = siguiente.some((e) => alias.get(e) === "ninas" || alias.get(e) === "ninos");
  const encabezados = dobleEncabezado
    ? fusionarEncabezados(hoja.filas[idx] ?? [], hoja.filas[idx + 1] ?? [])
    : (hoja.filas[idx] ?? []).map((c) => textoCelda(c));
  const primeraFilaDatos = idx + (dobleEncabezado ? 2 : 1);
  const filaEncabezado = hoja.origen + idx;
  base.filaEncabezado = filaEncabezado;

  // Columnas de conteo por edad: encabezado numérico entre 2 y 18.
  const columnasEdad: { indice: number; edad: number }[] = [];
  encabezados.forEach((crudo, i) => {
    const n = Number(normalizarEncabezado(crudo));
    if (Number.isInteger(n) && n >= EDAD_MIN_COLUMNA && n <= EDAD_MAX_COLUMNA) {
      columnasEdad.push({ indice: i, edad: n });
    }
  });
  const mapeo = mapearColumnas("sesiones", encabezados, filaEncabezado, (n) => {
    const num = Number(n);
    return Number.isInteger(num) && num >= EDAD_MIN_COLUMNA && num <= EDAD_MAX_COLUMNA;
  });
  base.columnasIgnoradas = mapeo.ignoradas;
  base.avisos.push(...mapeo.avisos);
  base.columnasReconocidas = [...mapeo.indices.keys()].map((k) => encabezadoDe("sesiones", k));
  if (columnasEdad.length) {
    base.columnasReconocidas.push(`Niños por edades (${columnasEdad.length} columnas)`);
  }

  const faltan = faltantes("sesiones", mapeo.indices);
  if (faltan.length) {
    base.columnasFaltantes = faltan;
    base.errores.push(errorDeColumnasFaltantes(faltan, encabezados));
    return base;
  }

  const celda = (fila: unknown[], clave: string): unknown => {
    const i = mapeo.indices.get(clave);
    return i === undefined ? "" : fila[i];
  };

  for (let i = primeraFilaDatos; i < hoja.filas.length; i++) {
    const cruda = hoja.filas[i] ?? [];
    const numeroFila = hoja.origen + i;
    if (filaVacia(cruda)) continue;

    const sesionCruda = textoCelda(celda(cruda, "sesion"));
    if (sesionCruda === "") continue; // renglón de totales o separador
    if (/^totales?$/.test(normalizar(sesionCruda))) continue;

    if (base.filas.length >= FILAS_MAXIMAS) {
      base.errores.push({
        fila: numeroFila,
        mensaje: `El archivo supera el máximo de ${FILAS_MAXIMAS} filas por importación.`,
      });
      break;
    }

    const errores: Incidencia[] = [];
    const fecha = tomar(aFecha(celda(cruda, "fecha"), "FECHA", anioEdicion), numeroFila, errores);

    const ninas = tomar(aEnteroOpcional(celda(cruda, "ninas"), "NIÑAS"), numeroFila, errores);
    const ninos = tomar(aEnteroOpcional(celda(cruda, "ninos"), "NIÑOS"), numeroFila, errores);
    const totalCelda = tomar(aEnteroOpcional(celda(cruda, "total"), "TOTAL"), numeroFila, errores);
    const mamas = tomar(aEnteroOpcional(celda(cruda, "mamas"), "MAMÁS"), numeroFila, errores);
    const papas = tomar(aEnteroOpcional(celda(cruda, "papas"), "PAPÁS"), numeroFila, errores);
    const preescolar = tomar(
      aEnteroOpcional(celda(cruda, "preescolar"), "EDUCACIÓN PRE ESCOLAR"), numeroFila, errores);
    const primaria = tomar(
      aEnteroOpcional(celda(cruda, "primaria"), "EDUCACIÓN PRIMARIA"), numeroFila, errores);
    const secundaria = tomar(
      aEnteroOpcional(celda(cruda, "secundaria"), "EDUCACIÓN SECUNDARIA"), numeroFila, errores);
    const mediaSuperior = tomar(
      aEnteroOpcional(celda(cruda, "mediaSuperior"), "EDUCACIÓN MEDIA SUPERIOR"), numeroFila, errores);

    const porEdad: Record<string, number> = {};
    for (const { indice, edad } of columnasEdad) {
      const v = tomar(aEnteroOpcional(cruda[indice], `Edad ${edad}`), numeroFila, errores);
      if (v && v > 0) porEdad[String(edad)] = v;
    }

    if (errores.length) {
      base.errores.push(...errores);
      continue;
    }

    const m = sesionCruda.match(RE_ORDEN);
    const orden = m ? Number(m[1]) : null;
    const tema = m ? m[2].trim() : sesionCruda;

    const sumaNinos = (ninas ?? 0) + (ninos ?? 0);
    const total = totalCelda && totalCelda > 0 ? totalCelda : sumaNinos;
    if (totalCelda && totalCelda > 0 && sumaNinos > 0 && totalCelda !== sumaNinos) {
      base.avisos.push({
        fila: numeroFila,
        mensaje: `«TOTAL» dice ${totalCelda} pero NIÑAS + NIÑOS suman ${sumaNinos}. Se guarda ${totalCelda}.`,
      });
    }

    const sede = textoCelda(celda(cruda, "sede")) || "MÉRIDA";
    const conDatos = total > 0 || sumaNinos > 0;

    const candidato = {
      orden,
      tema,
      clase: textoCelda(celda(cruda, "clase")) || tema,
      investigador:
        textoCelda(celda(cruda, "investigador")) || "Investigador(a) invitado(a) · CINVESTAV",
      sede,
      fecha: fecha as Date,
      notas:
        textoCelda(celda(cruda, "notas")) ||
        (conDatos ? "" : "Sesión sin datos de asistencia registrados."),
      conDatos,
      ninas: ninas ?? 0,
      ninos: ninos ?? 0,
      total,
      mamas: mamas ?? 0,
      papas: papas ?? 0,
      preescolar: preescolar ?? 0,
      primaria: primaria ?? 0,
      secundaria: secundaria ?? 0,
      mediaSuperior: mediaSuperior ?? 0,
      porEdad,
    };

    const datos = validarConZod(filaSesionSchema, "sesiones", numeroFila, candidato, base.errores);
    if (datos) base.filas.push({ fila: numeroFila, datos });
  }

  if (base.filas.length === 0 && base.errores.length === 0) {
    base.errores.push({ fila: null, mensaje: "El archivo no trae ninguna fila con datos." });
  }
  return base;
}

// ── Tipo 3 · Asistencia nominal ───────────────────────────────────────────────

export function parsearAsistencia(
  archivo: Buffer | ArrayBuffer,
  anioEdicion: number,
): ResultadoParseo<FilaAsistencia> {
  const hoja = leerHoja(archivo);
  const alias = indiceDeAlias("asistencia");

  const idx = localizarEncabezado(hoja, (etiquetas) => {
    const claves = new Set(etiquetas.map((e) => alias.get(e)).filter(Boolean));
    return claves.has("nombre") || claves.has("apellidos");
  });

  const base: ResultadoParseo<FilaAsistencia> = {
    tipo: "asistencia",
    hoja: hoja.nombre,
    filaEncabezado: 0,
    columnasReconocidas: [],
    columnasIgnoradas: [],
    columnasFaltantes: [],
    columnasSesion: [],
    filas: [],
    errores: [],
    avisos: [],
  };

  if (idx === -1) {
    base.errores.push({
      fila: null,
      mensaje:
        "No se encontró el renglón de encabezados. Debe traer «Nombre», «Apellidos» y una columna por cada sesión.",
    });
    return base;
  }

  const filaEncabezado = hoja.origen + idx;
  base.filaEncabezado = filaEncabezado;
  const encabezados = (hoja.filas[idx] ?? []).map((c) => textoCelda(c));
  const crudos = hoja.filas[idx] ?? [];

  const mapeo = mapearColumnas("asistencia", encabezados, filaEncabezado, () => true);
  base.avisos.push(...mapeo.avisos);
  base.columnasReconocidas = [...mapeo.indices.keys()].map((k) => encabezadoDe("asistencia", k));

  const faltan = faltantes("asistencia", mapeo.indices);
  if (faltan.length) {
    base.columnasFaltantes = faltan;
    base.errores.push(errorDeColumnasFaltantes(faltan, encabezados));
    return base;
  }

  const usadas = new Set(mapeo.indices.values());
  encabezados.forEach((crudo, i) => {
    if (usadas.has(i)) return;
    const norm = normalizarEncabezado(crudo);
    if (norm === "") return;
    if (COLUMNAS_IGNORADAS_ASISTENCIA.has(norm)) {
      base.columnasIgnoradas.push(crudo.trim());
      return;
    }
    const bruto = crudos[i];
    const conv = aFecha(bruto, crudo.trim(), anioEdicion);
    const fecha = conv.ok ? conv.valor : null;
    // Si el encabezado era una fecha nativa de Excel, su texto crudo es ilegible
    // (número de serie o ISO); se muestra la fecha ya formateada.
    const esFechaNativa = bruto instanceof Date || typeof bruto === "number";
    base.columnasSesion.push({
      indice: i,
      etiqueta: fecha && esFechaNativa ? claveFecha(fecha) : crudo.trim(),
      fecha,
    });
  });

  if (base.columnasSesion.length === 0) {
    base.errores.push({
      fila: filaEncabezado,
      mensaje:
        "No se encontró ninguna columna de sesión. Después de «Nombre» y «Apellidos» debe haber una columna por sesión, con la fecha o el nombre de la clase como encabezado.",
    });
    return base;
  }

  const celda = (fila: unknown[], clave: string): unknown => {
    const i = mapeo.indices.get(clave);
    return i === undefined ? "" : fila[i];
  };

  for (let i = idx + 1; i < hoja.filas.length; i++) {
    const cruda = hoja.filas[i] ?? [];
    const numeroFila = hoja.origen + i;
    if (filaVacia(cruda)) continue;

    const nombre = textoCelda(celda(cruda, "nombre"));
    const apellidos = textoCelda(celda(cruda, "apellidos"));
    if (nombre === "" && apellidos === "") continue;

    if (base.filas.length >= FILAS_MAXIMAS) {
      base.errores.push({
        fila: numeroFila,
        mensaje: `El archivo supera el máximo de ${FILAS_MAXIMAS} filas por importación.`,
      });
      break;
    }

    const errores: Incidencia[] = [];
    const marcas: FilaAsistencia["marcas"] = [];
    for (const col of base.columnasSesion) {
      const presente = tomar(aPresencia(cruda[col.indice], col.etiqueta), numeroFila, errores);
      if (presente === null) continue;
      marcas.push({
        columna: col.etiqueta,
        etiqueta: col.etiqueta,
        fecha: col.fecha,
        presente,
      });
    }

    if (errores.length) {
      base.errores.push(...errores);
      continue;
    }

    const datos = validarConZod(
      filaAsistenciaSchema,
      "asistencia",
      numeroFila,
      { nombre, apellidos, marcas },
      base.errores,
    );
    if (datos) base.filas.push({ fila: numeroFila, datos });
  }

  if (base.filas.length === 0 && base.errores.length === 0) {
    base.errores.push({ fila: null, mensaje: "El archivo no trae ninguna fila con datos." });
  }
  return base;
}

// ── Despachador ───────────────────────────────────────────────────────────────

export type ResultadoCualquiera =
  | ({ tipo: "participantes" } & ResultadoParseo<FilaParticipante>)
  | ({ tipo: "sesiones" } & ResultadoParseo<FilaSesion>)
  | ({ tipo: "asistencia" } & ResultadoParseo<FilaAsistencia>);

export function parsearArchivo(
  archivo: Buffer | ArrayBuffer,
  tipo: TipoImportacion,
  anioEdicion: number,
): ResultadoCualquiera {
  if (tipo === "participantes") {
    return parsearParticipantes(archivo) as ResultadoCualquiera;
  }
  if (tipo === "sesiones") {
    return parsearSesiones(archivo, anioEdicion) as ResultadoCualquiera;
  }
  return parsearAsistencia(archivo, anioEdicion) as ResultadoCualquiera;
}
