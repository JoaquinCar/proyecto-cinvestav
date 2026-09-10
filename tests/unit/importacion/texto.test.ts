import { describe, it, expect } from "vitest";
import {
  aEntero,
  aEnteroOpcional,
  aFecha,
  aGenero,
  aNivel,
  aPresencia,
  claveFecha,
  claveParticipante,
  derivarNivel,
  normalizar,
  normalizarEncabezado,
} from "@/lib/importacion/texto";

describe("normalizar / claveParticipante", () => {
  it("quita acentos, mayúsculas y espacios de más", () => {
    expect(normalizar("  Máxima   INTERIÁN  ")).toBe("maxima interian");
  });

  it("considera la misma persona aunque cambien acentos y mayúsculas", () => {
    expect(claveParticipante("Máxima", "Interián Poot")).toBe(
      claveParticipante("  maxima ", "INTERIAN   POOT"),
    );
  });

  it("distingue personas distintas", () => {
    expect(claveParticipante("Ana", "Pech")).not.toBe(claveParticipante("Ana", "Poot"));
  });
});

describe("normalizarEncabezado", () => {
  it("normaliza los encabezados del concentrado real", () => {
    expect(normalizarEncabezado("EDUCACIÓN PRE ESCOLAR")).toBe("educacion pre escolar");
    expect(normalizarEncabezado(" NIÑAS ")).toBe("ninas");
    expect(normalizarEncabezado("Nombre(s)")).toBe("nombre s");
    expect(normalizarEncabezado("#")).toBe("");
  });
});

describe("aEntero", () => {
  it("acepta números y texto numérico", () => {
    expect(aEntero(10, "Edad")).toEqual({ ok: true, valor: 10 });
    expect(aEntero(" 9 ", "Edad")).toEqual({ ok: true, valor: 9 });
    expect(aEntero("10 años", "Edad")).toEqual({ ok: true, valor: 10 });
  });

  it("rechaza texto sin dígitos citando lo que dice la celda", () => {
    const r = aEntero("diez", "Edad");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.mensaje).toBe("la columna «Edad» dice «diez», se esperaba un número");
    }
  });

  it("rechaza decimales", () => {
    const r = aEntero(10.5, "Edad");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.mensaje).toContain("número entero");
  });

  it("rechaza celda vacía cuando el número es obligatorio", () => {
    const r = aEntero("", "Edad");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.mensaje).toContain("está vacía");
  });

  it("aEnteroOpcional convierte la celda vacía en 0", () => {
    expect(aEnteroOpcional("", "NIÑAS")).toEqual({ ok: true, valor: 0 });
  });
});

describe("aGenero", () => {
  it("acepta las formas que usa el organizador", () => {
    expect(aGenero("Niña")).toEqual({ ok: true, valor: "FEMENINO" });
    expect(aGenero("NIÑO")).toEqual({ ok: true, valor: "MASCULINO" });
    expect(aGenero("F")).toEqual({ ok: true, valor: "FEMENINO" });
    expect(aGenero("FEMENINO")).toEqual({ ok: true, valor: "FEMENINO" });
  });

  it("deja vacío como sin especificar", () => {
    expect(aGenero("")).toEqual({ ok: true, valor: null });
  });

  it("rechaza «M» por ambiguo", () => {
    const r = aGenero("M");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.mensaje).toContain("ambiguo");
  });

  it("rechaza cualquier otra cosa", () => {
    const r = aGenero("otro");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.mensaje).toContain("se esperaba «Niña» o «Niño»");
  });
});

describe("aNivel / derivarNivel", () => {
  it("acepta las etiquetas visibles y las internas", () => {
    expect(aNivel("Media superior")).toEqual({ ok: true, valor: "MEDIA_SUPERIOR" });
    expect(aNivel("MEDIA_SUPERIOR")).toEqual({ ok: true, valor: "MEDIA_SUPERIOR" });
    expect(aNivel("Primaria")).toEqual({ ok: true, valor: "PRIMARIA" });
  });

  it("rechaza un nivel inventado", () => {
    const r = aNivel("Universidad");
    expect(r.ok).toBe(false);
  });

  it("deriva el nivel igual que scripts/normalizar.mjs", () => {
    expect(derivarNivel("4°", "Primaria Emma Godoy", 9)).toBe("PRIMARIA");
    expect(derivarNivel("2do", "Esc. Sec. #26", 13)).toBe("SECUNDARIA");
    expect(derivarNivel("3er semestre", "CECYTE", 17)).toBe("MEDIA_SUPERIOR");
    expect(derivarNivel("Preescolar", "Chak Pepen", 4)).toBe("PREESCOLAR");
    expect(derivarNivel("No va a escuela", "-", 7)).toBe("SIN_ESCUELA");
    // Sin pistas de texto, decide por edad.
    expect(derivarNivel("", "", 10)).toBe("PRIMARIA");
    expect(derivarNivel("", "", 13)).toBe("SECUNDARIA");
  });
});

describe("aFecha", () => {
  it("acepta «24 de enero» usando el año de la edición", () => {
    const r = aFecha("24 de enero", "FECHA", 2026);
    expect(r.ok).toBe(true);
    if (r.ok) expect(claveFecha(r.valor)).toBe("2026-01-24");
  });

  it("tolera espacios sobrantes como en el archivo real", () => {
    const r = aFecha("21 de febrero ", "FECHA", 2026);
    expect(r.ok).toBe(true);
    if (r.ok) expect(claveFecha(r.valor)).toBe("2026-02-21");
  });

  it("acepta año explícito, ISO y dd/mm/aaaa", () => {
    for (const [texto, esperado] of [
      ["24 de enero de 2025", "2025-01-24"],
      ["2026-03-07", "2026-03-07"],
      ["07/03/2026", "2026-03-07"],
    ] as const) {
      const r = aFecha(texto, "FECHA", 2026);
      expect(r.ok, texto).toBe(true);
      if (r.ok) expect(claveFecha(r.valor)).toBe(esperado);
    }
  });

  it("acepta el número de serie de Excel", () => {
    // 45681 = 2025-01-24
    const r = aFecha(45681, "FECHA", 2026);
    expect(r.ok).toBe(true);
    if (r.ok) expect(claveFecha(r.valor)).toBe("2025-01-24");
  });

  it("rechaza texto que no es fecha con un mensaje útil", () => {
    const r = aFecha("el jueves", "FECHA", 2026);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.mensaje).toContain("la columna «FECHA» dice «el jueves»");
      expect(r.mensaje).toContain("24 de enero");
    }
  });

  it("rechaza fechas que no existen", () => {
    const r = aFecha("31/02/2026", "FECHA", 2026);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.mensaje).toContain("no existe");
  });

  it("no corre el día por huso horario", () => {
    const r = aFecha("01 de enero", "FECHA", 2026);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.valor.getUTCHours()).toBe(12);
      expect(claveFecha(r.valor)).toBe("2026-01-01");
    }
  });
});

describe("aPresencia", () => {
  it("interpreta las marcas habituales", () => {
    expect(aPresencia("X", "24/01")).toEqual({ ok: true, valor: true });
    expect(aPresencia("sí", "24/01")).toEqual({ ok: true, valor: true });
    expect(aPresencia(1, "24/01")).toEqual({ ok: true, valor: true });
    expect(aPresencia("", "24/01")).toEqual({ ok: true, valor: false });
    expect(aPresencia("-", "24/01")).toEqual({ ok: true, valor: false });
    expect(aPresencia(0, "24/01")).toEqual({ ok: true, valor: false });
  });

  it("rechaza marcas que no entiende", () => {
    const r = aPresencia("tal vez", "24/01");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.mensaje).toContain("se esperaba «X»");
  });
});
