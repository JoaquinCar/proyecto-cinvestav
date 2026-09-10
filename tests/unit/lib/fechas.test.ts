import { describe, it, expect } from "vitest";
import {
  ZONA_PROGRAMA,
  aFechaCalendario,
  aISOFecha,
  formatearFecha,
  formatearInstante,
  estaEnRango,
} from "@/lib/fechas";

// ── Guardia de zona horaria ───────────────────────────────────────────────────
// El desfase de un día SOLO se manifiesta en zonas con offset negativo. CI corre
// en UTC, donde el bug es invisible: si esta prueba fallara, el resto del archivo
// no estaría probando nada. La zona se fija en vitest.config.ts.

describe("entorno de pruebas", () => {
  it("corre en la zona horaria del programa (America/Merida)", () => {
    expect(process.env.TZ).toBe("America/Merida");
    expect(new Date("2025-03-08T00:00:00.000Z").getDate()).toBe(7);
  });
});

// ── El bug que motivó el helper ───────────────────────────────────────────────

describe("regresión: fechas de calendario un día antes", () => {
  // Prisma guarda Sesion.fecha como medianoche UTC. Interpretarla en la zona
  // local (Mérida, UTC-6) retrocede al día anterior: el programa es sabatino y
  // la aplicación decía "viernes".
  const sabado = new Date("2025-03-08T00:00:00.000Z");

  it("la forma ingenua produce el día anterior (viernes 7)", () => {
    const ingenua = new Date(sabado).toLocaleDateString("es-MX", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
    expect(ingenua).toContain("viernes");
    expect(ingenua).toContain("7");
  });

  it("formatearFecha respeta el sábado 8 de marzo", () => {
    const formateada = formatearFecha(sabado, "completa");
    expect(formateada).toContain("sábado");
    expect(formateada).toContain("8");
    expect(formateada).toContain("marzo");
    expect(formateada).toContain("2025");
    expect(formateada).not.toContain("viernes");
  });

  it("respeta el sábado en todas las sesiones sabatinas de la edición", () => {
    const sabados = [
      "2025-02-08T00:00:00.000Z",
      "2025-02-22T00:00:00.000Z",
      "2025-03-08T00:00:00.000Z",
      "2025-03-22T00:00:00.000Z",
    ];
    for (const s of sabados) {
      expect(formatearFecha(new Date(s), "completa")).toContain("sábado");
    }
  });

  it("respeta el día en sesiones importadas (guardadas a mediodía UTC)", () => {
    // El importador de Excel guarda las fechas a las 12:00 UTC.
    expect(formatearFecha(new Date("2026-01-24T12:00:00.000Z"), "completa")).toContain(
      "sábado",
    );
    expect(aISOFecha(new Date("2026-01-24T12:00:00.000Z"))).toBe("2026-01-24");
  });
});

// ── aFechaCalendario ──────────────────────────────────────────────────────────

describe("aFechaCalendario", () => {
  it("convierte 'YYYY-MM-DD' a medianoche UTC de ese mismo día", () => {
    expect(aFechaCalendario("2025-03-08").toISOString()).toBe("2025-03-08T00:00:00.000Z");
  });

  it("trunca un ISO completo conservando el día que trae escrito", () => {
    expect(aFechaCalendario("2026-01-24T12:00:00.000Z").toISOString()).toBe(
      "2026-01-24T00:00:00.000Z",
    );
    // Un ISO con offset local no debe correr el día escrito.
    expect(aFechaCalendario("2025-03-08T20:00:00-06:00").toISOString()).toBe(
      "2025-03-08T00:00:00.000Z",
    );
  });

  it("trunca un Date de Prisma a medianoche UTC", () => {
    expect(aFechaCalendario(new Date("2025-03-08T00:00:00.000Z")).toISOString()).toBe(
      "2025-03-08T00:00:00.000Z",
    );
  });

  it("rechaza valores inválidos", () => {
    expect(() => aFechaCalendario("15/03/2025")).toThrow();
    expect(() => aFechaCalendario(new Date("no-es-fecha"))).toThrow();
  });
});

// ── aISOFecha ─────────────────────────────────────────────────────────────────

describe("aISOFecha", () => {
  it("devuelve el día de calendario en formato YYYY-MM-DD", () => {
    expect(aISOFecha(new Date("2025-03-08T00:00:00.000Z"))).toBe("2025-03-08");
    expect(aISOFecha("2025-03-08")).toBe("2025-03-08");
  });

  it("sirve para el valor de un <input type=\"date\"> sin correr el día", () => {
    // Con toLocaleDateString/local esto habría dado 2025-03-07.
    expect(aISOFecha(new Date("2025-03-08T00:00:00.000Z"))).not.toBe("2025-03-07");
  });
});

// ── formatearFecha: formatos ──────────────────────────────────────────────────

describe("formatearFecha", () => {
  const sabado = new Date("2025-03-08T00:00:00.000Z");

  it("acepta un string 'YYYY-MM-DD' igual que un Date", () => {
    expect(formatearFecha("2025-03-08", "larga")).toBe(formatearFecha(sabado, "larga"));
  });

  it("formato 'larga' incluye día, mes y año sin día de la semana", () => {
    const t = formatearFecha(sabado, "larga");
    expect(t).toContain("8");
    expect(t).toContain("marzo");
    expect(t).toContain("2025");
    expect(t).not.toContain("sábado");
  });

  it("formato 'media' abrevia el mes y conserva el año", () => {
    const t = formatearFecha(sabado, "media");
    expect(t).toContain("8");
    expect(t).toContain("2025");
    expect(t).not.toContain("marzo");
  });

  it("formato 'corta' es día y mes abreviado", () => {
    const t = formatearFecha(sabado, "corta");
    expect(t).toContain("8");
    expect(t).not.toContain("2025");
  });

  it("formato 'diaSemana' abrevia el día de la semana correcto", () => {
    const t = formatearFecha(sabado, "diaSemana");
    expect(t.toLowerCase()).toContain("sáb");
    expect(t).toContain("8");
  });
});

// ── formatearInstante ─────────────────────────────────────────────────────────

describe("formatearInstante", () => {
  it("usa la zona del programa, no la del servidor", () => {
    // 2025-03-09T02:00Z son todavía las 20:00 del 8 de marzo en Mérida.
    // Un servidor en UTC (Vercel) diría "9 de marzo" al emitir una constancia.
    const instante = new Date("2025-03-09T02:00:00.000Z");
    expect(formatearInstante(instante, "larga")).toContain("8");
    expect(formatearInstante(instante, "larga")).toContain("marzo");
  });

  it("no trunca a UTC como las fechas de calendario", () => {
    const instante = new Date("2025-03-09T02:00:00.000Z");
    expect(formatearInstante(instante, "larga")).not.toBe(
      formatearFecha(instante, "larga"),
    );
  });

  it("expone la zona del programa", () => {
    expect(ZONA_PROGRAMA).toBe("America/Merida");
  });
});

// ── estaEnRango ───────────────────────────────────────────────────────────────

describe("estaEnRango", () => {
  const inicio = new Date("2025-02-01T00:00:00.000Z");
  const fin = new Date("2025-06-30T00:00:00.000Z");

  it("acepta una fecha dentro del rango", () => {
    expect(estaEnRango("2025-03-08", inicio, fin)).toBe(true);
  });

  it("acepta los extremos inclusive", () => {
    expect(estaEnRango("2025-02-01", inicio, fin)).toBe(true);
    expect(estaEnRango("2025-06-30", inicio, fin)).toBe(true);
  });

  it("rechaza dedazos de año (1999 y 2200)", () => {
    expect(estaEnRango("1999-03-08", inicio, fin)).toBe(false);
    expect(estaEnRango("2200-03-08", inicio, fin)).toBe(false);
  });

  it("compara días de calendario, no instantes (edición guardada a mediodía UTC)", () => {
    const inicioMediodia = new Date("2026-01-24T12:00:00.000Z");
    const finMediodia = new Date("2026-06-27T12:00:00.000Z");
    // La sesión del primer día se guarda a medianoche UTC: como instante es
    // anterior al inicio, como día de calendario es el mismo.
    expect(estaEnRango("2026-01-24", inicioMediodia, finMediodia)).toBe(true);
    expect(estaEnRango("2026-06-27", inicioMediodia, finMediodia)).toBe(true);
    expect(estaEnRango("2026-06-28", inicioMediodia, finMediodia)).toBe(false);
  });
});
