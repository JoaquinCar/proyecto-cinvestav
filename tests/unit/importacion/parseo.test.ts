import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as XLSX from "xlsx";
import {
  ErrorArchivo,
  parsearArchivo,
  parsearAsistencia,
  parsearParticipantes,
  parsearSesiones,
} from "@/lib/importacion/parseo";
import { generarPlantilla } from "@/lib/importacion/plantillas";
import { claveFecha } from "@/lib/importacion/texto";

// ── Helper: arma un .xlsx en memoria a partir de una matriz ───────────────────

function hoja(matriz: unknown[][]): Buffer {
  const ws = XLSX.utils.aoa_to_sheet(matriz);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Hoja1");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

const ENCABEZADOS_PARTICIPANTES = [
  "Nombre", "Apellidos", "Edad", "Género", "Grado", "Nivel", "Escuela",
  "Ciudad", "Correo", "Teléfono",
];

// ─────────────────────────────────────────────────────────────────────────────
// Tipo 1 · Participantes
// ─────────────────────────────────────────────────────────────────────────────

describe("parsearParticipantes · archivo correcto", () => {
  const buffer = hoja([
    ENCABEZADOS_PARTICIPANTES,
    ["Ruby Valentina", "Canché Uc", 9, "Niña", "4°", "", "Primaria Emma Godoy", "Mérida", "a@b.mx", "999"],
    ["Diego", "Pech Bacab", 12, "Niño", "1° de secundaria", "", "Esc. Sec. #26", "", "", ""],
  ]);

  it("lee todas las filas sin errores", () => {
    const r = parsearParticipantes(buffer);
    expect(r.errores).toEqual([]);
    expect(r.filas).toHaveLength(2);
  });

  it("numera las filas como las ve el organizador en Excel", () => {
    const r = parsearParticipantes(buffer);
    expect(r.filaEncabezado).toBe(1);
    expect(r.filas[0].fila).toBe(2);
    expect(r.filas[1].fila).toBe(3);
  });

  it("deriva el nivel cuando la columna viene vacía", () => {
    const r = parsearParticipantes(buffer);
    expect(r.filas[0].datos.nivel).toBe("PRIMARIA");
    expect(r.filas[1].datos.nivel).toBe("SECUNDARIA");
  });

  it("aplica los valores por omisión de ciudad", () => {
    const r = parsearParticipantes(buffer);
    expect(r.filas[1].datos.ciudad).toBe("Mérida");
  });

  it("registra qué columnas venían llenas para no pisar datos buenos", () => {
    const r = parsearParticipantes(buffer);
    expect(r.filas[0].datos.provistos).toContain("correo");
    expect(r.filas[1].datos.provistos).not.toContain("correo");
  });
});

describe("parsearParticipantes · acepta el archivo que la app exporta", () => {
  it("ignora la columna «#» y entiende «Niña»/«Niño» del export", () => {
    // Encabezados exactos de GET /api/exportar/excel/[edicionId].
    const buffer = hoja([
      ["#", "Nombre", "Apellidos", "Edad", "Género", "Grado", "Nivel", "Escuela", "Ciudad", "Correo", "Teléfono"],
      [1, "Ruby", "Canché Uc", 9, "Niña", "4°", "Primaria", "Emma Godoy", "Mérida", "—", "—"],
    ]);
    const r = parsearParticipantes(buffer);
    expect(r.errores).toEqual([]);
    expect(r.filas[0].datos.genero).toBe("FEMENINO");
    expect(r.filas[0].datos.nivel).toBe("PRIMARIA");
    expect(r.columnasIgnoradas).not.toContain("#");
  });

  it("trata el «—» del export como celda vacía, no como dato", () => {
    // El export escribe «—» donde no hay valor. Sin esto, reimportarlo guardaría
    // «—» como correo y rompería la columna Nivel.
    const buffer = hoja([
      ["#", "Nombre", "Apellidos", "Edad", "Género", "Grado", "Nivel", "Escuela", "Ciudad", "Correo", "Teléfono"],
      [1, "Lucía", "Castro Navarro", 10, "Niña", "4to", "—", "Primaria Benito Juárez", "—", "—", "—"],
    ]);
    const r = parsearParticipantes(buffer);
    expect(r.errores).toEqual([]);
    const d = r.filas[0].datos;
    expect(d.correo).toBe("");
    expect(d.telefono).toBe("");
    expect(d.nivel).toBe("PRIMARIA"); // derivado, no el literal «—»
    expect(d.ciudad).toBe("Mérida");
    expect(d.provistos).not.toContain("correo");
    expect(d.provistos).not.toContain("ciudad");
    expect(d.provistos).not.toContain("nivel");
  });
});

describe("parsearParticipantes · acepta el orden del registro en Word", () => {
  it("mapea por nombre de columna, no por posición", () => {
    // Orden de scripts/parse-registro.ps1: nombre, apellidos, edad, grado, escuela…
    const buffer = hoja([
      ["Nombre", "Apellidos", "Edad", "Grado", "Escuela", "Correo", "Teléfono", "Ciudad"],
      ["Máxima", "Interián Poot", 5, "Preescolar", "-", "", "", ""],
    ]);
    const r = parsearParticipantes(buffer);
    expect(r.errores).toEqual([]);
    expect(r.filas[0].datos.escuela).toBe("Sin escuela");
    expect(r.filas[0].datos.nivel).toBe("PREESCOLAR");
  });
});

describe("parsearParticipantes · columnas faltantes", () => {
  it("no lee ninguna fila y dice qué falta y qué trae el archivo", () => {
    const buffer = hoja([
      ["Nombre", "Edad", "Escuela"],
      ["Ruby", 9, "Emma Godoy"],
    ]);
    const r = parsearParticipantes(buffer);
    expect(r.filas).toHaveLength(0);
    expect(r.columnasFaltantes).toEqual(["Apellidos"]);
    expect(r.errores[0].fila).toBeNull();
    expect(r.errores[0].mensaje).toContain("«Apellidos»");
    expect(r.errores[0].mensaje).toContain("El archivo trae: Nombre, Edad, Escuela");
  });

  it("avisa cuando no hay encabezados reconocibles", () => {
    const buffer = hoja([["cualquier", "cosa"], ["a", "b"]]);
    const r = parsearParticipantes(buffer);
    expect(r.errores[0].mensaje).toContain("No se encontró el renglón de encabezados");
  });
});

describe("parsearParticipantes · tipos equivocados", () => {
  it("señala la fila y la columna con el valor que trae", () => {
    const buffer = hoja([
      ENCABEZADOS_PARTICIPANTES,
      ["Ruby", "Canché", 9, "Niña", "4°", "", "Emma Godoy", "", "", ""],
      ["Ana", "Poot", "diez", "Niña", "3°", "", "Emma Godoy", "", "", ""],
    ]);
    const r = parsearParticipantes(buffer);
    expect(r.filas).toHaveLength(1);
    expect(r.errores).toHaveLength(1);
    expect(r.errores[0].fila).toBe(3);
    expect(r.errores[0].mensaje).toBe(
      "la columna «Edad» dice «diez», se esperaba un número",
    );
  });

  it("rechaza una edad fuera de rango con el límite en el mensaje", () => {
    const buffer = hoja([
      ENCABEZADOS_PARTICIPANTES,
      ["Ana", "Poot", 45, "Niña", "3°", "", "Emma Godoy", "", "", ""],
    ]);
    const r = parsearParticipantes(buffer);
    expect(r.filas).toHaveLength(0);
    expect(r.errores[0].fila).toBe(2);
    expect(r.errores[0].mensaje).toContain("la columna «Edad»");
    expect(r.errores[0].mensaje).toContain("18 años");
  });

  it("rechaza un género que no entiende", () => {
    const buffer = hoja([
      ENCABEZADOS_PARTICIPANTES,
      ["Ana", "Poot", 9, "otro", "3°", "", "Emma Godoy", "", "", ""],
    ]);
    const r = parsearParticipantes(buffer);
    expect(r.errores[0].fila).toBe(2);
    expect(r.errores[0].mensaje).toContain("«Género»");
  });

  it("ignora renglones totalmente vacíos al final de la hoja", () => {
    const buffer = hoja([
      ENCABEZADOS_PARTICIPANTES,
      ["Ana", "Poot", 9, "Niña", "3°", "", "Emma Godoy", "", "", ""],
      ["", "", "", "", "", "", "", "", "", ""],
      ["", "", "", "", "", "", "", "", "", ""],
    ]);
    const r = parsearParticipantes(buffer);
    expect(r.errores).toEqual([]);
    expect(r.filas).toHaveLength(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Tipo 2 · Sesiones y asistencia agregada
// ─────────────────────────────────────────────────────────────────────────────

describe("parsearSesiones · archivo REAL del organizador", () => {
  const buffer = readFileSync(
    resolve(process.cwd(), "asistencia-merida-2026.xlsx"),
  );

  it("entiende el encabezado de dos renglones con celdas combinadas", () => {
    const r = parsearSesiones(buffer, 2026);
    expect(r.errores).toEqual([]);
    expect(r.columnasReconocidas).toContain("NIÑAS");
    expect(r.columnasReconocidas).toContain("EDUCACIÓN MEDIA SUPERIOR");
    expect(r.columnasReconocidas).toContain("Niños por edades (16 columnas)");
  });

  it("lee las 12 sesiones y salta el renglón de TOTALES", () => {
    const r = parsearSesiones(buffer, 2026);
    expect(r.filas).toHaveLength(12);
    expect(r.filas.map((f) => f.datos.orden)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it("separa el número de orden del tema", () => {
    const r = parsearSesiones(buffer, 2026);
    expect(r.filas[0].datos.tema).toBe(
      "Cómputo bio-inspirado: Cuando la naturaleza y las matemáticas se unen",
    );
  });

  it("resuelve «24 de enero» con el año de la edición", () => {
    const r = parsearSesiones(buffer, 2026);
    expect(claveFecha(r.filas[0].datos.fecha)).toBe("2026-01-24");
    expect(claveFecha(r.filas[11].datos.fecha)).toBe("2026-06-27");
  });

  it("reproduce los totales que ya carga scripts/cargar-2026.mjs", () => {
    const r = parsearSesiones(buffer, 2026);
    const primera = r.filas[0].datos;
    expect(primera).toMatchObject({
      ninas: 14, ninos: 17, total: 31, mamas: 7, papas: 4,
      preescolar: 3, primaria: 10, secundaria: 4, mediaSuperior: 1,
      sede: "MÉRIDA", conDatos: true,
    });
    expect(primera.porEdad).toEqual({
      "5": 2, "6": 1, "7": 3, "8": 5, "9": 4, "10": 2, "11": 7,
      "12": 1, "13": 2, "14": 1, "15": 1, "16": 1, "17": 1,
    });
  });

  it("marca como «sin datos» las sesiones que aún no se impartieron", () => {
    const r = parsearSesiones(buffer, 2026);
    const sinDatos = r.filas.filter((f) => !f.datos.conDatos);
    expect(sinDatos).toHaveLength(5);
    expect(sinDatos[0].datos.notas).toBe("Sesión sin datos de asistencia registrados.");
  });

  it("ignora la columna «TOTAL» repetida de escuelas y la columna «MÉRIDA»", () => {
    const r = parsearSesiones(buffer, 2026);
    expect(r.avisos.some((a) => a.mensaje.includes("TOTAL"))).toBe(true);
    expect(r.columnasIgnoradas).toContain("MÉRIDA");
  });

  it("los totales suman lo mismo que el renglón TOTALES del archivo", () => {
    const r = parsearSesiones(buffer, 2026);
    const conDatos = r.filas.filter((f) => f.datos.conDatos);
    const suma = (k: "ninas" | "ninos" | "total" | "mamas" | "papas") =>
      conDatos.reduce((a, f) => a + f.datos[k], 0);
    expect(suma("ninas")).toBe(92);
    expect(suma("ninos")).toBe(85);
    expect(suma("total")).toBe(177);
    expect(suma("mamas")).toBe(32);
    expect(suma("papas")).toBe(21);
  });
});

describe("parsearSesiones · encabezado de un solo renglón (la plantilla)", () => {
  it("acepta también la versión simple", () => {
    const buffer = hoja([
      ["SESIÓN", "SEDE", "FECHA", "INVESTIGADOR", "NIÑAS", "NIÑOS", "TOTAL"],
      ["1. Robótica", "MÉRIDA", "24 de enero", "Dr. X", 5, 6, 11],
    ]);
    const r = parsearSesiones(buffer, 2026);
    expect(r.errores).toEqual([]);
    expect(r.filas[0].fila).toBe(2);
    expect(r.filas[0].datos.investigador).toBe("Dr. X");
    expect(r.filas[0].datos.clase).toBe("Robótica");
  });

  it("agrupa varias sesiones bajo la columna CLASE cuando viene llena", () => {
    const buffer = hoja([
      ["SESIÓN", "FECHA", "CLASE"],
      ["Sesión 1", "24 de enero", "Astronomía"],
      ["Sesión 2", "7 de febrero", "Astronomía"],
    ]);
    const r = parsearSesiones(buffer, 2026);
    expect(r.filas.map((f) => f.datos.clase)).toEqual(["Astronomía", "Astronomía"]);
  });

  it("calcula el TOTAL cuando falta y avisa si no cuadra", () => {
    const buffer = hoja([
      ["SESIÓN", "FECHA", "NIÑAS", "NIÑOS", "TOTAL"],
      ["Uno", "24 de enero", 5, 6, ""],
      ["Dos", "7 de febrero", 5, 6, 99],
    ]);
    const r = parsearSesiones(buffer, 2026);
    expect(r.filas[0].datos.total).toBe(11);
    expect(r.filas[1].datos.total).toBe(99);
    expect(r.avisos.some((a) => a.fila === 3 && a.mensaje.includes("TOTAL"))).toBe(true);
  });

  it("señala la fila con fecha inválida", () => {
    const buffer = hoja([
      ["SESIÓN", "FECHA"],
      ["Uno", "24 de enero"],
      ["Dos", "cuando se pueda"],
    ]);
    const r = parsearSesiones(buffer, 2026);
    expect(r.filas).toHaveLength(1);
    expect(r.errores[0].fila).toBe(3);
    expect(r.errores[0].mensaje).toContain("«cuando se pueda»");
  });

  it("exige la columna FECHA", () => {
    const buffer = hoja([["SESIÓN", "NIÑAS"], ["Uno", 3]]);
    const r = parsearSesiones(buffer, 2026);
    expect(r.columnasFaltantes).toEqual(["FECHA"]);
    expect(r.filas).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Tipo 3 · Asistencia nominal
// ─────────────────────────────────────────────────────────────────────────────

describe("parsearAsistencia", () => {
  it("detecta las columnas de sesión por fecha", () => {
    const buffer = hoja([
      ["Nombre", "Apellidos", "24/01/2026", "07/02/2026", "Total"],
      ["Ruby", "Canché Uc", "X", "", 1],
      ["Diego", "Pech Bacab", "X", "X", 2],
    ]);
    const r = parsearAsistencia(buffer, 2026);
    expect(r.errores).toEqual([]);
    expect(r.columnasSesion).toHaveLength(2);
    expect(r.columnasSesion.map((c) => claveFecha(c.fecha!))).toEqual([
      "2026-01-24",
      "2026-02-07",
    ]);
    expect(r.columnasIgnoradas).toContain("Total");
    expect(r.filas[0].datos.marcas.map((m) => m.presente)).toEqual([true, false]);
  });

  it("acepta encabezados con el nombre de la clase", () => {
    const buffer = hoja([
      ["Nombre", "Apellidos", "Astronomía", "Robótica"],
      ["Ruby", "Canché Uc", "X", "-"],
    ]);
    const r = parsearAsistencia(buffer, 2026);
    expect(r.errores).toEqual([]);
    expect(r.columnasSesion.map((c) => c.etiqueta)).toEqual(["Astronomía", "Robótica"]);
    expect(r.columnasSesion.every((c) => c.fecha === null)).toBe(true);
  });

  it("acepta «24 de enero» como encabezado y le pone el año de la edición", () => {
    const buffer = hoja([
      ["Nombre", "Apellidos", "24 de enero"],
      ["Ruby", "Canché Uc", "X"],
    ]);
    const r = parsearAsistencia(buffer, 2025);
    expect(claveFecha(r.columnasSesion[0].fecha!)).toBe("2025-01-24");
  });

  it("señala la fila y la columna cuando la marca no se entiende", () => {
    const buffer = hoja([
      ["Nombre", "Apellidos", "24/01/2026"],
      ["Ruby", "Canché Uc", "tal vez"],
    ]);
    const r = parsearAsistencia(buffer, 2026);
    expect(r.filas).toHaveLength(0);
    expect(r.errores[0].fila).toBe(2);
    expect(r.errores[0].mensaje).toContain("«24/01/2026» dice «tal vez»");
  });

  it("exige al menos una columna de sesión", () => {
    const buffer = hoja([["Nombre", "Apellidos"], ["Ruby", "Canché Uc"]]);
    const r = parsearAsistencia(buffer, 2026);
    expect(r.errores[0].mensaje).toContain("ninguna columna de sesión");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Archivos que no se pueden abrir
// ─────────────────────────────────────────────────────────────────────────────

describe("archivos inválidos", () => {
  it("lanza ErrorArchivo cuando el archivo no es una hoja de cálculo", () => {
    // Cabecera PNG: xlsx la reconoce como imagen y se niega a abrirla.
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
    expect(() => parsearParticipantes(png)).toThrow(ErrorArchivo);
  });

  it("no revienta con un archivo de texto: lo reporta como sin encabezados", () => {
    const texto = Buffer.from("esto no es un xlsx", "utf8");
    const r = parsearParticipantes(texto);
    expect(r.filas).toHaveLength(0);
    expect(r.errores[0].mensaje).toContain("No se encontró el renglón de encabezados");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Ida y vuelta: la plantilla que se descarga se puede volver a importar
// ─────────────────────────────────────────────────────────────────────────────

describe("las plantillas descargables se importan sin errores", () => {
  it("participantes", () => {
    const r = parsearArchivo(generarPlantilla("participantes", 2026), "participantes", 2026);
    expect(r.errores).toEqual([]);
    expect(r.filas).toHaveLength(3);
  });

  it("sesiones", () => {
    const r = parsearArchivo(generarPlantilla("sesiones", 2026), "sesiones", 2026);
    expect(r.errores).toEqual([]);
    expect(r.filas).toHaveLength(2);
  });

  it("asistencia", () => {
    const r = parsearArchivo(generarPlantilla("asistencia", 2026), "asistencia", 2026);
    expect(r.errores).toEqual([]);
    expect(r.filas).toHaveLength(2);
    expect(r.columnasSesion).toHaveLength(3);
  });
});
