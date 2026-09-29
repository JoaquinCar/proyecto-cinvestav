import { describe, it, expect, vi, beforeEach } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// La constancia le toca a TODO inscrito.
//
// Hasta ahora la constancia se ganaba: solo la recibía quien alcanzaba
// `Edicion.minAsistencias`. El cliente pidió lo contrario — "constancia para
// todos y un admin puede decir a quién no se le da, pero por defecto todos"—,
// así que el mínimo dejó de decidir y lo que decide es una exclusión explícita.
//
// Estas pruebas fijan esa inversión: sin exclusión, elegible; con exclusión,
// no, y con motivo, autor y fecha guardados.
// ─────────────────────────────────────────────────────────────────────────────

vi.mock("@/lib/prisma", () => ({
  prisma: {
    inscripcion: {
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    edicion: { findUnique: vi.fn() },
  },
}));

vi.mock("@/lib/supabase", () => ({ getSupabaseAdmin: vi.fn() }));

vi.mock("@/lib/pdf/constancia", () => ({
  generarPDFConstancia: vi.fn(async () => Buffer.from("%PDF-falso")),
}));

/** Inscripción tal como la lee `verificarElegibilidad`. */
function inscripcionMock(overrides: Record<string, unknown> = {}) {
  return {
    id: "insc-1",
    constanciaUrl: null,
    constanciaGenerada: false,
    constanciaExcluida: false,
    constanciaMotivoExclusion: null,
    constanciaExcluidaAt: null,
    constanciaExcluidaPor: null,
    participante: {
      id: "p-1",
      nombre: "Ana",
      apellidos: "García",
      escuela: "Primaria Centro",
      grado: "3° primaria",
    },
    edicion: {
      id: "ed-1",
      nombre: "Pasaporte Científico Mérida 2026",
      anio: 2026,
      minAsistencias: 6,
      porcentajeMinimo: null,
      asistenciaGlobal: true,
      clases: [{ sesiones: [{ id: "s1" }, { id: "s2" }] }],
    },
    asistencias: [],
    ...overrides,
  };
}

async function conInscripcion(overrides: Record<string, unknown> = {}) {
  const { prisma } = await import("@/lib/prisma");
  vi.mocked(prisma.inscripcion.findUnique).mockResolvedValue(
    inscripcionMock(overrides) as never,
  );
  return prisma;
}

describe("verificarElegibilidad — la constancia es de todos por defecto", () => {
  beforeEach(() => vi.clearAllMocks());

  it("un inscrito sin ninguna asistencia es elegible", async () => {
    await conInscripcion({ asistencias: [] });

    const { verificarElegibilidad } = await import(
      "@/server/queries/constancias"
    );
    const resultado = await verificarElegibilidad("insc-1");

    // Esto es exactamente lo que ANTES devolvía false.
    expect(resultado?.elegible).toBe(true);
    expect(resultado?.exclusion.excluida).toBe(false);
  });

  it("el mínimo de asistencias sigue informando, pero ya no decide", async () => {
    await conInscripcion({ asistencias: [{ id: "a1" }, { id: "a2" }] });

    const { verificarElegibilidad } = await import(
      "@/server/queries/constancias"
    );
    const resultado = await verificarElegibilidad("insc-1");

    expect(resultado?.asistencias).toBe(2);
    expect(resultado?.minimo).toBe(6);
    expect(resultado?.cumpleMinimo).toBe(false);
    // …y aun así le toca constancia.
    expect(resultado?.elegible).toBe(true);
  });

  it("una inscripción excluida deja de ser elegible y dice por qué, quién y cuándo", async () => {
    const cuando = new Date("2026-07-01T18:00:00.000Z");
    await conInscripcion({
      constanciaExcluida: true,
      constanciaMotivoExclusion: "Se dio de baja del programa en la segunda sesión",
      constanciaExcluidaAt: cuando,
      constanciaExcluidaPor: {
        id: "u-admin",
        name: "Coordinación",
        email: "admin@cinvestav.mx",
      },
      asistencias: [{ id: "a1" }, { id: "a2" }, { id: "a3" }, { id: "a4" }, { id: "a5" }, { id: "a6" }],
    });

    const { verificarElegibilidad } = await import(
      "@/server/queries/constancias"
    );
    const resultado = await verificarElegibilidad("insc-1");

    expect(resultado?.elegible).toBe(false);
    expect(resultado?.exclusion.excluida).toBe(true);
    expect(resultado?.exclusion.motivo).toMatch(/se dio de baja/i);
    expect(resultado?.exclusion.fecha).toEqual(cuando);
    expect(resultado?.exclusion.por?.email).toBe("admin@cinvestav.mx");
    // Cumplir el mínimo no reincorpora a nadie: la exclusión manda.
    expect(resultado?.cumpleMinimo).toBe(true);
  });
});

describe("generarYGuardarConstancia — una exclusión bloquea la emisión", () => {
  beforeEach(() => vi.clearAllMocks());

  it("no arma ni sube el PDF de un excluido", async () => {
    const prisma = await conInscripcion({
      constanciaExcluida: true,
      constanciaMotivoExclusion: "No completó el trámite de consentimiento",
    });
    const { getSupabaseAdmin } = await import("@/lib/supabase");
    const { generarPDFConstancia } = await import("@/lib/pdf/constancia");

    const { generarYGuardarConstancia, ConstanciaExcluidaError } = await import(
      "@/server/queries/constancias"
    );

    const error = await generarYGuardarConstancia("insc-1").catch((e) => e);

    expect(error).toBeInstanceOf(ConstanciaExcluidaError);
    expect(error.message).toMatch(/excluid/i);
    expect(error.message).toMatch(/no completó el trámite/i);
    expect(generarPDFConstancia).not.toHaveBeenCalled();
    expect(getSupabaseAdmin).not.toHaveBeenCalled();
    expect(prisma.inscripcion.update).not.toHaveBeenCalled();
  });
});

describe("actualizarExclusionConstancia", () => {
  beforeEach(() => vi.clearAllMocks());

  it("excluir guarda motivo, autor y fecha", async () => {
    const { prisma } = await import("@/lib/prisma");
    vi.mocked(prisma.inscripcion.updateMany).mockResolvedValue({
      count: 1,
    } as never);

    const { actualizarExclusionConstancia } = await import(
      "@/server/queries/constancias"
    );

    const antes = Date.now();
    const { actualizadas } = await actualizarExclusionConstancia({
      inscripcionIds: ["insc-1"],
      excluida: true,
      motivo: "  Cambió de ciudad a media edición  ",
      usuarioId: "u-admin",
    });

    expect(actualizadas).toBe(1);

    const llamada = vi.mocked(prisma.inscripcion.updateMany).mock.calls[0][0];
    expect(llamada.where).toEqual({ id: { in: ["insc-1"] } });
    const datos = llamada.data as Record<string, unknown>;
    expect(datos.constanciaExcluida).toBe(true);
    // El motivo se guarda sin los espacios sobrantes del formulario.
    expect(datos.constanciaMotivoExclusion).toBe("Cambió de ciudad a media edición");
    expect(datos.constanciaExcluidaPorId).toBe("u-admin");
    expect((datos.constanciaExcluidaAt as Date).getTime()).toBeGreaterThanOrEqual(antes);
  });

  it("excluir no toca las asistencias ni la constancia ya emitida", async () => {
    const { prisma } = await import("@/lib/prisma");
    vi.mocked(prisma.inscripcion.updateMany).mockResolvedValue({
      count: 2,
    } as never);

    const { actualizarExclusionConstancia } = await import(
      "@/server/queries/constancias"
    );
    await actualizarExclusionConstancia({
      inscripcionIds: ["insc-1", "insc-2"],
      excluida: true,
      motivo: "Duplicado del padrón",
      usuarioId: "u-admin",
    });

    const datos = vi.mocked(prisma.inscripcion.updateMany).mock.calls[0][0]
      .data as Record<string, unknown>;

    // Excluir es marcar, no borrar: el historial del niño se queda donde está.
    expect(datos).not.toHaveProperty("constanciaUrl");
    expect(datos).not.toHaveProperty("constanciaGenerada");
    expect(datos).not.toHaveProperty("asistencias");
    expect(datos).not.toHaveProperty("participanteId");
  });

  it("reincorporar limpia la exclusión entera", async () => {
    const { prisma } = await import("@/lib/prisma");
    vi.mocked(prisma.inscripcion.updateMany).mockResolvedValue({
      count: 1,
    } as never);

    const { actualizarExclusionConstancia } = await import(
      "@/server/queries/constancias"
    );
    await actualizarExclusionConstancia({
      inscripcionIds: ["insc-1"],
      excluida: false,
      motivo: "esto se ignora al reincorporar",
      usuarioId: "u-admin",
    });

    const datos = vi.mocked(prisma.inscripcion.updateMany).mock.calls[0][0]
      .data as Record<string, unknown>;
    expect(datos.constanciaExcluida).toBe(false);
    expect(datos.constanciaMotivoExclusion).toBeNull();
    expect(datos.constanciaExcluidaAt).toBeNull();
    expect(datos.constanciaExcluidaPorId).toBeNull();
  });
});

describe("listarConstanciasDeEdicion", () => {
  beforeEach(() => vi.clearAllMocks());

  it("marca a cada inscrito con derecho salvo a los excluidos", async () => {
    const { prisma } = await import("@/lib/prisma");
    vi.mocked(prisma.edicion.findUnique).mockResolvedValue({
      id: "ed-1",
      nombre: "Pasaporte Científico Mérida 2026",
      anio: 2026,
      minAsistencias: 6,
      porcentajeMinimo: null,
      cerrada: false,
      clases: [{ sesiones: [{ id: "s1" }, { id: "s2" }] }],
    } as never);

    vi.mocked(prisma.inscripcion.findMany).mockResolvedValue([
      {
        id: "insc-1",
        constanciaUrl: null,
        constanciaGenerada: false,
        constanciaExcluida: false,
        constanciaMotivoExclusion: null,
        constanciaExcluidaAt: null,
        constanciaExcluidaPor: null,
        participante: {
          id: "p-1",
          nombre: "Ana",
          apellidos: "García",
          escuela: "Primaria Centro",
          grado: "3°",
        },
        _count: { asistencias: 0 },
      },
      {
        id: "insc-2",
        constanciaUrl: null,
        constanciaGenerada: false,
        constanciaExcluida: true,
        constanciaMotivoExclusion: "Inscripción duplicada",
        constanciaExcluidaAt: new Date("2026-07-01T18:00:00.000Z"),
        constanciaExcluidaPor: {
          id: "u-admin",
          name: "Coordinación",
          email: "admin@cinvestav.mx",
        },
        participante: {
          id: "p-2",
          nombre: "Luis",
          apellidos: "Pérez",
          escuela: "Primaria Sur",
          grado: "4°",
        },
        _count: { asistencias: 7 },
      },
    ] as never);

    const { listarConstanciasDeEdicion } = await import(
      "@/server/queries/constancias"
    );
    const resultado = await listarConstanciasDeEdicion("ed-1");

    expect(resultado).not.toBeNull();
    expect(resultado!.resumen.inscritos).toBe(2);
    expect(resultado!.resumen.conDerecho).toBe(1);
    expect(resultado!.resumen.excluidos).toBe(1);
    expect(resultado!.resumen.emitidas).toBe(0);

    const [ana, luis] = resultado!.filas;
    expect(ana.elegible).toBe(true);
    expect(ana.cumpleMinimo).toBe(false);
    expect(luis.elegible).toBe(false);
    expect(luis.exclusion.motivo).toBe("Inscripción duplicada");
    // Cumple el mínimo y aun así está excluido: son cosas independientes.
    expect(luis.cumpleMinimo).toBe(true);
  });

  it("devuelve null si la edición no existe", async () => {
    const { prisma } = await import("@/lib/prisma");
    vi.mocked(prisma.edicion.findUnique).mockResolvedValue(null as never);

    const { listarConstanciasDeEdicion } = await import(
      "@/server/queries/constancias"
    );
    expect(await listarConstanciasDeEdicion("no-existe")).toBeNull();
  });
});
