import { describe, it, expect, vi, beforeEach } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// Guardar la constancia en el almacenamiento de archivos.
//
// Este era el peor caso de la app: el `catch {}` de la ruta era literalmente
// vacío, así que "falta crear el espacio de archivos constancias" y "la base se
// cayó" salían idénticos por pantalla ("Error interno del servidor") y sin
// dejar rastro en el log. Aquí se fija que cada motivo llega con nombre propio.
// ─────────────────────────────────────────────────────────────────────────────

vi.mock("@/lib/prisma", () => ({
  prisma: {
    inscripcion: { findUnique: vi.fn(), update: vi.fn() },
  },
}));

vi.mock("@/lib/supabase", () => ({ getSupabaseAdmin: vi.fn() }));

vi.mock("@/lib/pdf/constancia", () => ({
  generarPDFConstancia: vi.fn(async () => Buffer.from("%PDF-falso")),
}));

const inscripcionMock = {
  id: "insc-1",
  participante: {
    nombre: "Juan",
    apellidos: "Pérez",
    escuela: "Primaria Centro",
    grado: "3° primaria",
  },
  edicion: {
    id: "ed-1",
    nombre: "Pasaporte Científico 2025",
    anio: 2025,
    clases: [{ sesiones: [{ id: "s1" }, { id: "s2" }] }],
  },
  asistencias: [{ id: "a1" }, { id: "a2" }],
};

/** Cliente de almacenamiento cuyo `upload` devuelve el error indicado. */
function almacenamientoQueFalla(mensaje: string) {
  return {
    storage: {
      from: () => ({
        upload: vi.fn(async () => ({ error: { message: mensaje } })),
        getPublicUrl: vi.fn(() => ({ data: { publicUrl: "" } })),
      }),
    },
  };
}

describe("generarYGuardarConstancia — fallos del almacenamiento", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { prisma } = await import("@/lib/prisma");
    vi.mocked(prisma.inscripcion.findUnique).mockResolvedValue(
      inscripcionMock as never,
    );
  });

  it("distingue que el almacenamiento no está configurado", async () => {
    const { getSupabaseAdmin } = await import("@/lib/supabase");
    vi.mocked(getSupabaseAdmin).mockImplementation(() => {
      throw new Error(
        "Missing Supabase env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY",
      );
    });

    const { generarYGuardarConstancia, AlmacenamientoNoConfiguradoError } =
      await import("@/server/queries/constancias");

    await expect(generarYGuardarConstancia("insc-1")).rejects.toBeInstanceOf(
      AlmacenamientoNoConfiguradoError,
    );

    const error = await generarYGuardarConstancia("insc-1").catch((e) => e);
    expect(error.message).toMatch(/no está configurado/i);
    expect(error.message).toMatch(/no quedó guardada/i);
    expect(error.message).toMatch(/avisa a quien administra/i);
    // El nombre de las variables de entorno no sale a pantalla.
    expect(error.message).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY|env var/i);
  });

  it("dice que falta el espacio de archivos cuando el bucket no existe", async () => {
    const { getSupabaseAdmin } = await import("@/lib/supabase");
    vi.mocked(getSupabaseAdmin).mockReturnValue(
      almacenamientoQueFalla("Bucket not found") as never,
    );

    const { generarYGuardarConstancia, AlmacenamientoNoDisponibleError } =
      await import("@/server/queries/constancias");

    const error = await generarYGuardarConstancia("insc-1").catch((e) => e);

    expect(error).toBeInstanceOf(AlmacenamientoNoDisponibleError);
    // El motivo exacto del servicio viaja: es justo el dato que necesita quien
    // administra para crear el espacio que falta.
    expect(error.message).toContain("Bucket not found");
    expect(error.message).toContain("constancias");
    // Y se dice la verdad sobre lo que pasó: el PDF se armó, no quedó guardado.
    expect(error.message).toMatch(/no quedó guardado/i);
    expect(error.message).not.toMatch(/at .*\(|\/Users\//);
  });

  it("no marca la constancia como generada si el guardado falló", async () => {
    const { getSupabaseAdmin } = await import("@/lib/supabase");
    vi.mocked(getSupabaseAdmin).mockReturnValue(
      almacenamientoQueFalla("Bucket not found") as never,
    );

    const { generarYGuardarConstancia } = await import(
      "@/server/queries/constancias"
    );
    await generarYGuardarConstancia("insc-1").catch(() => undefined);

    const { prisma } = await import("@/lib/prisma");
    expect(prisma.inscripcion.update).not.toHaveBeenCalled();
  });

  it("avisa con nombre propio si la inscripción desapareció", async () => {
    const { prisma } = await import("@/lib/prisma");
    vi.mocked(prisma.inscripcion.findUnique).mockResolvedValue(null as never);

    const { generarYGuardarConstancia, InscripcionNoEncontradaError } =
      await import("@/server/queries/constancias");

    const error = await generarYGuardarConstancia("insc-1").catch((e) => e);
    expect(error).toBeInstanceOf(InscripcionNoEncontradaError);
    expect(error.message).toMatch(/vuelve a cargar la página/i);
  });
});
