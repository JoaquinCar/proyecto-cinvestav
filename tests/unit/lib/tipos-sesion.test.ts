import { describe, it, expect } from "vitest";
import {
  TIPOS_SESION,
  TIPOS_QUE_CUENTAN,
  ASISTENCIAS_QUE_CUENTAN,
  CLASES_QUE_CUENTAN,
  cuentaParaElPrograma,
  exigeInvestigador,
  etiquetaTipo,
  esTipoSesion,
} from "@/lib/tipos-sesion";

// ─────────────────────────────────────────────────────────────────────────────
// La regla de QUÉ CUENTA vive en un solo sitio.
//
// «Contar» son dos cosas que se deciden con la misma lista: sumar al mínimo de
// la constancia y entrar en las estadísticas (tablero, ficha de la edición,
// análisis profundo y comparativo entre ediciones).
//
// Estas pruebas son el candado: si alguien reparte la condición por el código,
// o cambia el criterio sin querer, aquí se nota. Cambiar el criterio a
// propósito se hace tocando `TIPOS_QUE_CUENTAN` y nada más —
// y entonces estas pruebas fallan a propósito, que es justo lo que se quiere.
// ─────────────────────────────────────────────────────────────────────────────

describe("catálogo de tipos de sesión", () => {
  it("tiene exactamente los tres tipos del programa", () => {
    expect(TIPOS_SESION.map((t) => t.valor)).toEqual([
      "PASAPORTE",
      "LECTURA",
      "EVENTO",
    ]);
  });

  it("cada tipo se nombra en español para la interfaz", () => {
    expect(etiquetaTipo("PASAPORTE")).toBe("Sesión de pasaporte");
    expect(etiquetaTipo("LECTURA")).toBe("Sesión de lectura");
    expect(etiquetaTipo("EVENTO")).toBe("Evento especial");
  });

  it("reconoce un tipo válido y rechaza cualquier otra cosa", () => {
    expect(esTipoSesion("EVENTO")).toBe(true);
    expect(esTipoSesion("CLAUSURA")).toBe(false);
    expect(esTipoSesion("")).toBe(false);
    expect(esTipoSesion(undefined)).toBe(false);
  });
});

describe("qué cuenta — constancia y estadísticas", () => {
  it("solo las sesiones de pasaporte cuentan", () => {
    expect([...TIPOS_QUE_CUENTAN]).toEqual(["PASAPORTE"]);
  });

  it("la lectura y los eventos NO suman al mínimo ni a las estadísticas", () => {
    expect(cuentaParaElPrograma("PASAPORTE")).toBe(true);
    expect(cuentaParaElPrograma("LECTURA")).toBe(false);
    expect(cuentaParaElPrograma("EVENTO")).toBe(false);
  });

  it("el filtro de asistencias exige presente y tipo que cuente", () => {
    // Este objeto es el que viaja a Prisma desde constancias.ts y
    // participantes.ts: si deja de mirar el tipo, una clausura empezaría a
    // sumar sin que nadie lo pidiera.
    expect(ASISTENCIAS_QUE_CUENTAN).toEqual({
      presente: true,
      sesion: { clase: { tipo: { in: ["PASAPORTE"] } } },
    });
  });

  it("el filtro de clases acota el denominador al mismo criterio", () => {
    expect(CLASES_QUE_CUENTAN).toEqual({ tipo: { in: ["PASAPORTE"] } });
  });

  it("los dos filtros y el helper usan la MISMA lista", () => {
    const esperado: string[] = [...TIPOS_QUE_CUENTAN];
    expect(CLASES_QUE_CUENTAN.tipo.in).toEqual(esperado);
    expect(ASISTENCIAS_QUE_CUENTAN.sesion.clase.tipo.in).toEqual(esperado);
    for (const { valor } of TIPOS_SESION) {
      expect(cuentaParaElPrograma(valor)).toBe(esperado.includes(valor));
    }
  });
});

describe("investigador según el tipo", () => {
  it("una charla lo exige; una clausura no tiene investigador", () => {
    expect(exigeInvestigador("PASAPORTE")).toBe(true);
    expect(exigeInvestigador("LECTURA")).toBe(true);
    expect(exigeInvestigador("EVENTO")).toBe(false);
  });
});
