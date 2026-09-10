// Plantillas .xlsx descargables: los encabezados exactos que el importador
// espera, más un renglón de ejemplo para que se vea el formato de cada celda.

import * as XLSX from "xlsx";
import {
  COLUMNAS_PARTICIPANTES,
  COLUMNAS_SESIONES,
  EDAD_MAX_COLUMNA,
  EDAD_MIN_COLUMNA,
  type TipoImportacion,
} from "./columnas";
import { celdaSegura } from "./texto";

export interface Plantilla {
  nombreArchivo: string;
  encabezados: string[];
  /** Filas de ejemplo, alineadas con `encabezados`. */
  ejemplos: (string | number)[][];
}

function edadesEncabezados(): string[] {
  const out: string[] = [];
  for (let e = EDAD_MIN_COLUMNA; e <= EDAD_MAX_COLUMNA; e++) out.push(String(e));
  return out;
}

const EJEMPLO_PARTICIPANTES: (string | number)[][] = [
  ["Ruby Valentina", "Canché Uc", 9, "Niña", "4°", "Primaria", "Primaria Emma Godoy", "Mérida", "mama.ruby@ejemplo.mx", "9991234567"],
  ["Diego Emiliano", "Pech Bacab", 12, "Niño", "1° de secundaria", "", "Secundaria Técnica #26", "Mérida", "", ""],
  ["Máxima", "Interián Poot", 5, "Niña", "Preescolar", "Preescolar", "Preescolar Chak Pepen", "Umán", "", ""],
];

const EJEMPLO_SESIONES: (string | number)[][] = [
  ["1. Cómputo bio-inspirado", "MÉRIDA", "24 de enero", "", "Dra. Ejemplo Pérez", 14, 17, 31, 7, 4, 3, 10, 4, 1, ""],
  ["2. Descubre el mundo con los mapas", "MÉRIDA", "7 de febrero", "", "", 17, 12, 29, 5, 4, 2, 9, 4, 1, ""],
];

const EJEMPLO_ASISTENCIA: (string | number)[][] = [
  ["Ruby Valentina", "Canché Uc", "X", "X", ""],
  ["Diego Emiliano", "Pech Bacab", "X", "", "X"],
];

export function plantillaDe(tipo: TipoImportacion, anio: number): Plantilla {
  if (tipo === "participantes") {
    return {
      nombreArchivo: "plantilla-participantes.xlsx",
      encabezados: COLUMNAS_PARTICIPANTES.map((c) => c.encabezado),
      ejemplos: EJEMPLO_PARTICIPANTES,
    };
  }
  if (tipo === "sesiones") {
    const edades = edadesEncabezados();
    return {
      nombreArchivo: "plantilla-sesiones.xlsx",
      encabezados: [...COLUMNAS_SESIONES.map((c) => c.encabezado), ...edades],
      // Los conteos por edad del ejemplo se dejan vacíos: son opcionales.
      ejemplos: EJEMPLO_SESIONES.map((f) => [...f, ...edades.map(() => "")]),
    };
  }
  return {
    nombreArchivo: "plantilla-asistencia.xlsx",
    encabezados: ["Nombre", "Apellidos", `24/01/${anio}`, `07/02/${anio}`, `21/02/${anio}`],
    ejemplos: EJEMPLO_ASISTENCIA,
  };
}

/** Genera el .xlsx de la plantilla. */
export function generarPlantilla(tipo: TipoImportacion, anio: number): Buffer {
  const { encabezados, ejemplos } = plantillaDe(tipo, anio);
  const matriz: (string | number)[][] = [
    encabezados,
    ...ejemplos.map((fila) =>
      fila.map((v) => (typeof v === "string" ? celdaSegura(v) : v)),
    ),
  ];
  const hoja = XLSX.utils.aoa_to_sheet(matriz);
  hoja["!cols"] = encabezados.map((h) => ({ wch: Math.max(10, Math.min(32, h.length + 4)) }));
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, "Plantilla");
  return XLSX.write(libro, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
