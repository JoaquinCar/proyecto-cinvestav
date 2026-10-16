import { describe, it, expect, vi, beforeEach } from "vitest";
import { CLASES_QUE_CUENTAN } from "@/lib/tipos-sesion";

// ─────────────────────────────────────────────────────────────────────────────
// LAS ESTADÍSTICAS CUENTAN SOLO LO QUE CUENTA.
//
// El coordinador vio «Asistencia capturada 12/22 · faltan 10 por capturar» en
// una edición de 12 sesiones de pasaporte, 8 de lectura y 2 eventos. Las diez
// que «faltaban» eran los extras. Tenía que decir 12/12.
//
// La prueba de verdad, con datos sembrados, está en
// tests/integration/db/estadisticas-solo-pasaporte.test.ts — pero esa necesita
// `PRUEBAS_DB=1` y se salta en una corrida normal. Estas de aquí son las que
// corren siempre: comprueban que la consulta le pide a Prisma el filtro por
// tipo, y que el filtro es EL del módulo de decisión y no una copia escrita a
// mano que luego se quede atrás.
// ─────────────────────────────────────────────────────────────────────────────

vi.mock("@/lib/prisma", () => ({
  prisma: {
    sesion: { findMany: vi.fn(), count: vi.fn() },
    inscripcion: { findMany: vi.fn(), count: vi.fn() },
    clase: { findMany: vi.fn() },
    edicion: { findUnique: vi.fn(), findMany: vi.fn() },
  },
}));

/** El `where` de un `prisma.sesion.findMany`, tal como viajó a la base. */
type WhereSesion = { clase?: Record<string, unknown> };

describe("obtenerMetricasAsistencia — solo sesiones que cuentan", () => {
  beforeEach(() => vi.clearAllMocks());

  it("le pide a Prisma únicamente las sesiones de los tipos que cuentan", async () => {
    const { prisma } = await import("@/lib/prisma");
    vi.mocked(prisma.sesion.findMany).mockResolvedValue([] as never);

    const { obtenerMetricasAsistencia } = await import("@/server/queries/estadisticas");
    await obtenerMetricasAsistencia("ed-1");

    const where = vi.mocked(prisma.sesion.findMany).mock.calls[0][0]
      ?.where as WhereSesion;
    expect(where.clase).toMatchObject({ edicionId: "ed-1", ...CLASES_QUE_CUENTAN });
  });
});

describe("obtenerAnalisisProfundo — solo sesiones que cuentan", () => {
  beforeEach(() => vi.clearAllMocks());

  it("aplica el mismo filtro que el tablero", async () => {
    const { prisma } = await import("@/lib/prisma");
    vi.mocked(prisma.inscripcion.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.sesion.findMany).mockResolvedValue([] as never);

    const { obtenerAnalisisProfundo } = await import("@/server/queries/estadisticas");
    await obtenerAnalisisProfundo("ed-1");

    const where = vi.mocked(prisma.sesion.findMany).mock.calls[0][0]
      ?.where as WhereSesion;
    expect(where.clase).toMatchObject({ edicionId: "ed-1", ...CLASES_QUE_CUENTAN });
  });
});

describe("obtenerEdicionPorId — solo sesiones que cuentan", () => {
  beforeEach(() => vi.clearAllMocks());

  it("los DOS conteos filtran por tipo, no solo uno", async () => {
    // Filtrar el numerador y no el denominador —o al revés— es peor que no
    // filtrar: la fracción quedaría sin sentido («14 de 22»).
    const { prisma } = await import("@/lib/prisma");
    vi.mocked(prisma.edicion.findUnique).mockResolvedValue({
      id: "ed-1",
      anio: 2026,
      _count: { inscripciones: 51, clases: 22 },
    } as never);
    vi.mocked(prisma.sesion.count).mockResolvedValue(0 as never);

    const { obtenerEdicionPorId } = await import("@/server/queries/ediciones");
    await obtenerEdicionPorId("ed-1");

    const wheres = vi
      .mocked(prisma.sesion.count)
      .mock.calls.map((c) => c[0]?.where as WhereSesion);
    expect(wheres).toHaveLength(2);
    for (const w of wheres) {
      expect(w.clase).toMatchObject({ edicionId: "ed-1", ...CLASES_QUE_CUENTAN });
    }
  });

  it("la tarjeta «Sesiones» de la ficha TAMBIÉN se filtra", async () => {
    // Esta prueba fijaba lo contrario: `_count.clases` era el inventario
    // completo y enseñaba 22 a propósito, para no esconder la lectura ni los
    // eventos. El coordinador lo revirtió el 15 de octubre de 2026 al ver «22»
    // junto a «12 de 12» en la misma pantalla, hablando de cosas distintas.
    // Ahora toda cifra de la ficha cuenta lo mismo; el inventario completo
    // sigue a la vista en la lista de sesiones y en «Actividades por tipo».
    const { prisma } = await import("@/lib/prisma");
    vi.mocked(prisma.edicion.findUnique).mockResolvedValue({
      id: "ed-1",
      anio: 2026,
      _count: { inscripciones: 51, clases: 12 },
    } as never);
    vi.mocked(prisma.sesion.count).mockResolvedValue(12 as never);

    const { obtenerEdicionPorId } = await import("@/server/queries/ediciones");
    const e = await obtenerEdicionPorId("ed-1");

    expect(e?._count.clases).toBe(12);
    expect(e?.sesionesTotal).toBe(12);
    expect(e?.sesionesCapturadas).toBe(12);

    const seleccion = vi.mocked(prisma.edicion.findUnique).mock.calls[0][0]?.select;
    const clases = (seleccion?._count as { select?: Record<string, unknown> })?.select
      ?.clases;
    expect(clases, "el conteo de clases de la ficha lleva el filtro del programa")
      .toMatchObject({ where: CLASES_QUE_CUENTAN });
  });
});

describe("obtenerHistoricoEdiciones — el comparativo cuenta lo mismo", () => {
  beforeEach(() => vi.clearAllMocks());

  it("no cuenta lecturas ni eventos de ediciones pasadas", async () => {
    // Si no, la gráfica «Sesiones por edición» diría 22 justo al lado de un
    // tablero que dice 12, para el mismo año.
    const { prisma } = await import("@/lib/prisma");
    vi.mocked(prisma.edicion.findMany).mockResolvedValue([] as never);

    const { obtenerHistoricoEdiciones } = await import("@/server/queries/historico");
    await obtenerHistoricoEdiciones();

    const incluye = vi.mocked(prisma.edicion.findMany).mock.calls[0][0]?.include as
      | { clases?: { where?: unknown } }
      | undefined;
    expect(incluye?.clases?.where).toEqual(CLASES_QUE_CUENTAN);
  });
});
