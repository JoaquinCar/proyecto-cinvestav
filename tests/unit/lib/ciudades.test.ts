import { describe, it, expect } from "vitest";
import { CIUDADES, normalizarCiudad } from "@/lib/ciudades";

// ─────────────────────────────────────────────────────────────────────────────
// CIUDAD DEL PARTICIPANTE — el dato que se quiere analizar.
//
// El coordinador pidió el campo porque la pregunta que le interesa es «de dónde
// vienen los niños». Esa pregunta solo tiene respuesta si la misma localidad se
// escribe siempre igual: «Mérida», «merida», «MERIDA» y «Mérida, Yuc.» son una
// sola ciudad y tienen que contarse como una sola barra en la gráfica.
//
// Por eso el campo NO es un texto libre a secas ni un desplegable cerrado:
//   · El desplegable cerrado perdería a quien viene de fuera del catálogo.
//   · El texto libre a secas parte la estadística en cuatro.
// Se sugiere el catálogo y se canoniza lo que se escriba. Es el mismo patrón
// que ya usa `grado` (datalist + `derivarNivel`).
// ─────────────────────────────────────────────────────────────────────────────

describe("normalizarCiudad", () => {
  it("devuelve null cuando no hay dato", () => {
    expect(normalizarCiudad(null)).toBeNull();
    expect(normalizarCiudad(undefined)).toBeNull();
    expect(normalizarCiudad("")).toBeNull();
    expect(normalizarCiudad("   ")).toBeNull();
  });

  it("trata los marcadores de «aquí no hay dato» como ausencia", () => {
    // El export de la propia aplicación escribe «—» en las celdas vacías.
    expect(normalizarCiudad("—")).toBeNull();
    expect(normalizarCiudad("-")).toBeNull();
    expect(normalizarCiudad("N/A")).toBeNull();
    expect(normalizarCiudad("sin dato")).toBeNull();
  });

  it("canoniza las grafías de una misma ciudad del catálogo", () => {
    for (const grafia of ["merida", "MERIDA", "Mérida", "  mérida  ", "MÉRIDA"]) {
      expect(normalizarCiudad(grafia)).toBe("Mérida");
    }
  });

  it("devuelve los acentos que la gente no escribe", () => {
    expect(normalizarCiudad("uman")).toBe("Umán");
    expect(normalizarCiudad("kanasin")).toBe("Kanasín");
    expect(normalizarCiudad("hunucma")).toBe("Hunucmá");
  });

  it("quita el estado y el país que algunos añaden", () => {
    expect(normalizarCiudad("Mérida, Yuc.")).toBe("Mérida");
    expect(normalizarCiudad("Merida Yucatan")).toBe("Mérida");
    expect(normalizarCiudad("Mérida, Yucatán, México")).toBe("Mérida");
    expect(normalizarCiudad("Progreso, Yuc")).toBe("Progreso");
  });

  it("colapsa los espacios de más", () => {
    expect(normalizarCiudad("Chicxulub   Puerto")).toBe("Chicxulub Puerto");
  });

  it("conserva —y capitaliza— una ciudad que no está en el catálogo", () => {
    // El programa es de Mérida y alrededores, pero un niño de visita puede
    // venir de cualquier parte: perder ese dato sería peor que tenerlo suelto.
    expect(normalizarCiudad("cancún")).toBe("Cancún");
    expect(normalizarCiudad("CIUDAD DEL CARMEN")).toBe("Ciudad del Carmen");
    expect(normalizarCiudad("san josé tzal")).toBe("San José Tzal");
  });

  it("no inventa acentos en una ciudad desconocida", () => {
    // Solo el catálogo sabe dónde van los acentos; fuera de él se respeta lo
    // que se escribió, sin adivinar.
    expect(normalizarCiudad("cancun")).toBe("Cancun");
  });

  it("deja cada entrada del catálogo igual que está escrita", () => {
    for (const ciudad of CIUDADES) {
      expect(normalizarCiudad(ciudad)).toBe(ciudad);
    }
  });

  it("ofrece Mérida como primera sugerencia", () => {
    // Es de donde viene la inmensa mayoría: va arriba para que sea un clic.
    expect(CIUDADES[0]).toBe("Mérida");
  });

  it("no repite ciudades en el catálogo", () => {
    expect(new Set(CIUDADES).size).toBe(CIUDADES.length);
  });

  it("recorta lo que exceda el máximo admitido por la columna", () => {
    expect(normalizarCiudad("x".repeat(300))!.length).toBeLessThanOrEqual(100);
  });
});
