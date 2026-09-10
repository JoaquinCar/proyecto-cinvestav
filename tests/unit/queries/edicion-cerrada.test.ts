import { describe, it, expect, vi, beforeEach } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// Congelar una edición: una edición cerrada conserva lectura y reportes, pero
// deja de aceptar escrituras (asistencias, sesiones, temas).
// ─────────────────────────────────────────────────────────────────────────────

vi.mock("@/lib/prisma", () => ({
  prisma: {
    edicion: { findUnique: vi.fn() },
    sesion: { findUnique: vi.fn(), findMany: vi.fn() },
    inscripcion: { findMany: vi.fn() },
    asistencia: { upsert: vi.fn() },
    $transaction: vi.fn(),
  },
}));

const abierta = { id: "ed-2027", cerrada: false, anio: 2027 };
const cerrada = { id: "ed-2025", cerrada: true, anio: 2025 };

describe("assertEdicionAbierta", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deja pasar una edición abierta", async () => {
    const { prisma } = await import("@/lib/prisma");
    vi.mocked(prisma.edicion.findUnique).mockResolvedValue(abierta as never);
    const { assertEdicionAbierta } = await import(
      "@/server/queries/edicion-cerrada"
    );
    await expect(assertEdicionAbierta("ed-2027")).resolves.toBeUndefined();
  });

  it("bloquea una edición cerrada", async () => {
    const { prisma } = await import("@/lib/prisma");
    vi.mocked(prisma.edicion.findUnique).mockResolvedValue(cerrada as never);
    const { assertEdicionAbierta, EdicionCerradaError } = await import(
      "@/server/queries/edicion-cerrada"
    );
    await expect(assertEdicionAbierta("ed-2025")).rejects.toBeInstanceOf(
      EdicionCerradaError,
    );
  });

  it("bloquea si la edición no existe", async () => {
    const { prisma } = await import("@/lib/prisma");
    vi.mocked(prisma.edicion.findUnique).mockResolvedValue(null as never);
    const { assertEdicionAbierta, EdicionCerradaError } = await import(
      "@/server/queries/edicion-cerrada"
    );
    await expect(assertEdicionAbierta("fantasma")).rejects.toBeInstanceOf(
      EdicionCerradaError,
    );
  });
});

describe("assertEdicionDeSesionAbierta", () => {
  beforeEach(() => vi.clearAllMocks());

  it("bloquea cuando la sesión pertenece a una edición cerrada", async () => {
    const { prisma } = await import("@/lib/prisma");
    vi.mocked(prisma.sesion.findUnique).mockResolvedValue({
      clase: { edicion: cerrada },
    } as never);
    const { assertEdicionDeSesionAbierta, EdicionCerradaError } = await import(
      "@/server/queries/edicion-cerrada"
    );
    await expect(assertEdicionDeSesionAbierta("ses-1")).rejects.toBeInstanceOf(
      EdicionCerradaError,
    );
  });

  it("deja pasar cuando la edición de la sesión está abierta", async () => {
    const { prisma } = await import("@/lib/prisma");
    vi.mocked(prisma.sesion.findUnique).mockResolvedValue({
      clase: { edicion: abierta },
    } as never);
    const { assertEdicionDeSesionAbierta } = await import(
      "@/server/queries/edicion-cerrada"
    );
    await expect(
      assertEdicionDeSesionAbierta("ses-1"),
    ).resolves.toBeUndefined();
  });
});

// ── Efecto en el registro de asistencias ─────────────────────────────────────

describe("batchUpsertAsistencias sobre edición cerrada", () => {
  beforeEach(() => vi.clearAllMocks());

  it("no escribe nada y lanza EdicionCerradaError", async () => {
    const { prisma } = await import("@/lib/prisma");
    vi.mocked(prisma.inscripcion.findMany).mockResolvedValue([
      { id: "insc-1", edicionId: "ed-2025" },
    ] as never);
    vi.mocked(prisma.sesion.findMany).mockResolvedValue([
      { id: "ses-1", clase: { edicionId: "ed-2025" } },
    ] as never);
    vi.mocked(prisma.edicion.findUnique).mockResolvedValue(cerrada as never);

    const { batchUpsertAsistencias } = await import(
      "@/server/queries/asistencias"
    );
    const { EdicionCerradaError } = await import(
      "@/server/queries/edicion-cerrada"
    );

    await expect(
      batchUpsertAsistencias([
        { inscripcionId: "insc-1", sesionId: "ses-1", presente: true },
      ]),
    ).rejects.toBeInstanceOf(EdicionCerradaError);

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.asistencia.upsert).not.toHaveBeenCalled();
  });

  it("escribe normalmente si la edición sigue abierta", async () => {
    const { prisma } = await import("@/lib/prisma");
    vi.mocked(prisma.inscripcion.findMany).mockResolvedValue([
      { id: "insc-1", edicionId: "ed-2027" },
    ] as never);
    vi.mocked(prisma.sesion.findMany).mockResolvedValue([
      { id: "ses-1", clase: { edicionId: "ed-2027" } },
    ] as never);
    vi.mocked(prisma.edicion.findUnique).mockResolvedValue(abierta as never);
    vi.mocked(prisma.$transaction).mockResolvedValue([{ id: "a-1" }] as never);

    const { batchUpsertAsistencias } = await import(
      "@/server/queries/asistencias"
    );

    await expect(
      batchUpsertAsistencias([
        { inscripcionId: "insc-1", sesionId: "ses-1", presente: true },
      ]),
    ).resolves.toHaveLength(1);
    expect(prisma.$transaction).toHaveBeenCalled();
  });
});
