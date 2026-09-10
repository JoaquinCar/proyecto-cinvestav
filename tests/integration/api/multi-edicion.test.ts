import { describe, it, expect, vi, beforeEach } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// Aislamiento entre ediciones.
//
// El modelo (Participante global + Inscripcion por edición) permite que un niño
// repita en varias ediciones. Estas pruebas verifican que las CONSULTAS respeten
// ese diseño y que los datos de 2025/2026/2027 nunca se mezclen.
// ─────────────────────────────────────────────────────────────────────────────

vi.mock("@/lib/prisma", () => ({
  prisma: {
    participante: {
      findMany: vi.fn(),
    },
    inscripcion: {
      findMany: vi.fn(),
    },
    sesion: {
      findMany: vi.fn(),
    },
    asistencia: {
      upsert: vi.fn(),
    },
    edicion: {
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

// Aquí se prueba el aislamiento entre ediciones, no el congelado: se da por
// hecho que las ediciones están abiertas. Ver tests/unit/queries/edicion-cerrada.
vi.mock("@/server/queries/edicion-cerrada", () => ({
  assertEdicionAbierta: vi.fn(),
  assertEdicionDeSesionAbierta: vi.fn(),
  assertEdicionDeClaseAbierta: vi.fn(),
  EdicionCerradaError: class EdicionCerradaError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "EdicionCerradaError";
    }
  },
}));

const sessionBecario = {
  user: {
    id: "user-2",
    email: "becario@cinvestav.mx",
    role: "BECARIO",
    name: "Becario",
    image: null,
  },
};

function makeRequest(method: string, path: string, body?: unknown): Request {
  return new Request(`http://localhost${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

// ── Listado de participantes por edición ─────────────────────────────────────

describe("buscarParticipantes — aislamiento por edición", () => {
  beforeEach(() => vi.clearAllMocks());

  it("restringe el listado a los inscritos en la edición indicada", async () => {
    const { prisma } = await import("@/lib/prisma");
    vi.mocked(prisma.participante.findMany).mockResolvedValueOnce([] as never);

    const { buscarParticipantes } = await import("@/server/queries/participantes");
    await buscarParticipantes(undefined, "edicion-2027");

    const args = vi.mocked(prisma.participante.findMany).mock.calls[0]![0]!;
    expect(args.where).toMatchObject({
      inscripciones: { some: { edicionId: "edicion-2027" } },
    });
  });

  it("combina la búsqueda por texto con el filtro de edición", async () => {
    const { prisma } = await import("@/lib/prisma");
    vi.mocked(prisma.participante.findMany).mockResolvedValueOnce([] as never);

    const { buscarParticipantes } = await import("@/server/queries/participantes");
    await buscarParticipantes("Ana", "edicion-2027");

    const args = vi.mocked(prisma.participante.findMany).mock.calls[0]![0]!;
    expect(args.where).toMatchObject({
      inscripciones: { some: { edicionId: "edicion-2027" } },
    });
    expect(args.where).toHaveProperty("OR");
  });

  it("no trunca a 50 el listado de una edición (una edición puede tener más niños)", async () => {
    const { prisma } = await import("@/lib/prisma");
    vi.mocked(prisma.participante.findMany).mockResolvedValueOnce([] as never);

    const { buscarParticipantes } = await import("@/server/queries/participantes");
    await buscarParticipantes(undefined, "edicion-2027");

    const args = vi.mocked(prisma.participante.findMany).mock.calls[0]![0]!;
    expect(args.take ?? Infinity).toBeGreaterThan(50);
  });

  it("sin edicionId busca en todas las ediciones (reinscribir a un niño de 2025)", async () => {
    const { prisma } = await import("@/lib/prisma");
    vi.mocked(prisma.participante.findMany).mockResolvedValueOnce([] as never);

    const { buscarParticipantes } = await import("@/server/queries/participantes");
    await buscarParticipantes("Ana");

    const args = vi.mocked(prisma.participante.findMany).mock.calls[0]![0]!;
    expect(args.where).not.toHaveProperty("inscripciones");
    expect(args.take).toBe(50);
  });
});

// ── Una sola edición activa a la vez ─────────────────────────────────────────

describe("activarEdicion — nunca deja dos ediciones activas", () => {
  beforeEach(() => vi.clearAllMocks());

  it("desactiva todas las ediciones antes de activar la solicitada", async () => {
    const { prisma } = await import("@/lib/prisma");

    const tx = {
      edicion: {
        updateMany: vi.fn().mockResolvedValue({ count: 2 }),
        update: vi
          .fn()
          .mockResolvedValue({ id: "edicion-2027", activa: true }),
      },
    };
    // Se ejecuta el callback de la transacción con un tx instrumentado.
    vi.mocked(prisma.$transaction).mockImplementationOnce(
      (async (fn: (t: typeof tx) => unknown) => fn(tx)) as never,
    );

    const { activarEdicion } = await import("@/server/queries/ediciones");
    await activarEdicion("edicion-2027");

    expect(tx.edicion.updateMany).toHaveBeenCalledWith({
      data: { activa: false },
    });
    expect(tx.edicion.update).toHaveBeenCalledWith({
      where: { id: "edicion-2027" },
      data: { activa: true },
    });
    // El orden importa: primero apagar todas, luego encender una.
    expect(tx.edicion.updateMany.mock.invocationCallOrder[0]).toBeLessThan(
      tx.edicion.update.mock.invocationCallOrder[0]!,
    );
  });
});

// ── Asistencias que cruzan ediciones ─────────────────────────────────────────

describe("batchUpsertAsistencias — rechaza asistencias entre ediciones distintas", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lanza AsistenciaFueraDeEdicionError si la inscripción es de otra edición", async () => {
    const { prisma } = await import("@/lib/prisma");
    vi.mocked(prisma.inscripcion.findMany).mockResolvedValueOnce([
      { id: "insc-2026", edicionId: "edicion-2026" },
    ] as never);
    vi.mocked(prisma.sesion.findMany).mockResolvedValueOnce([
      { id: "sesion-2027", clase: { edicionId: "edicion-2027" } },
    ] as never);

    const { batchUpsertAsistencias, AsistenciaFueraDeEdicionError } = await import(
      "@/server/queries/asistencias"
    );

    await expect(
      batchUpsertAsistencias([
        { inscripcionId: "insc-2026", sesionId: "sesion-2027", presente: true },
      ]),
    ).rejects.toBeInstanceOf(AsistenciaFueraDeEdicionError);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("acepta la asistencia cuando inscripción y sesión son de la misma edición", async () => {
    const { prisma } = await import("@/lib/prisma");
    vi.mocked(prisma.inscripcion.findMany).mockResolvedValueOnce([
      { id: "insc-2027", edicionId: "edicion-2027" },
    ] as never);
    vi.mocked(prisma.sesion.findMany).mockResolvedValueOnce([
      { id: "sesion-2027", clase: { edicionId: "edicion-2027" } },
    ] as never);
    vi.mocked(prisma.$transaction).mockResolvedValueOnce([{ id: "a1" }] as never);

    const { batchUpsertAsistencias } = await import("@/server/queries/asistencias");

    const resultado = await batchUpsertAsistencias([
      { inscripcionId: "insc-2027", sesionId: "sesion-2027", presente: true },
    ]);

    expect(resultado).toHaveLength(1);
    expect(prisma.$transaction).toHaveBeenCalledOnce();
  });

  it("lanza AsistenciaFueraDeEdicionError si la inscripción o la sesión no existen", async () => {
    const { prisma } = await import("@/lib/prisma");
    vi.mocked(prisma.inscripcion.findMany).mockResolvedValueOnce([] as never);
    vi.mocked(prisma.sesion.findMany).mockResolvedValueOnce([
      { id: "sesion-2027", clase: { edicionId: "edicion-2027" } },
    ] as never);

    const { batchUpsertAsistencias, AsistenciaFueraDeEdicionError } = await import(
      "@/server/queries/asistencias"
    );

    await expect(
      batchUpsertAsistencias([
        { inscripcionId: "insc-fantasma", sesionId: "sesion-2027", presente: true },
      ]),
    ).rejects.toBeInstanceOf(AsistenciaFueraDeEdicionError);
  });
});

// ── El endpoint traduce el error a 409 ───────────────────────────────────────

describe("POST /api/asistencias — asistencia entre ediciones", () => {
  beforeEach(() => vi.clearAllMocks());

  it("responde 409 cuando la inscripción no pertenece a la edición de la sesión", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(sessionBecario as never);

    const { prisma } = await import("@/lib/prisma");
    vi.mocked(prisma.inscripcion.findMany).mockResolvedValueOnce([
      { id: "clxyz1234567890abcdef0001", edicionId: "edicion-2026" },
    ] as never);
    vi.mocked(prisma.sesion.findMany).mockResolvedValueOnce([
      { id: "clxyz1234567890abcdef0002", clase: { edicionId: "edicion-2027" } },
    ] as never);

    const { POST } = await import("@/app/api/asistencias/route");
    const req = makeRequest("POST", "/api/asistencias", {
      items: [
        {
          inscripcionId: "clxyz1234567890abcdef0001",
          sesionId: "clxyz1234567890abcdef0002",
          presente: true,
        },
      ],
    });
    const res = await POST(req as never);

    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error).toMatch(/edición/i);
  });
});
