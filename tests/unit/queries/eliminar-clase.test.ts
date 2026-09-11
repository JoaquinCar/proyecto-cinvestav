import { describe, it, expect, vi, beforeEach } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// Eliminar una clase.
//
// Sesion → Clase no está en cascada. Sin comprobarlo antes, el `delete` chocaba
// contra la llave foránea y la ruta devolvía "Error interno del servidor": el
// coordinador no tenía forma de saber que lo que estorbaba eran las sesiones.
// ─────────────────────────────────────────────────────────────────────────────

vi.mock("@/lib/prisma", () => ({
  prisma: {
    asistencia: { count: vi.fn() },
    sesion: { count: vi.fn() },
    clase: { delete: vi.fn() },
  },
}));

describe("eliminarClase", () => {
  beforeEach(() => vi.clearAllMocks());

  it("elimina la clase cuando no arrastra sesiones ni asistencias", async () => {
    const { prisma } = await import("@/lib/prisma");
    vi.mocked(prisma.asistencia.count).mockResolvedValue(0 as never);
    vi.mocked(prisma.sesion.count).mockResolvedValue(0 as never);
    vi.mocked(prisma.clase.delete).mockResolvedValue({ id: "clase-1" } as never);

    const { eliminarClase } = await import("@/server/queries/clases");
    await expect(eliminarClase("clase-1")).resolves.toEqual({ id: "clase-1" });
  });

  it("rechaza con el conteo de sesiones y qué hacer, sin tocar la base", async () => {
    const { prisma } = await import("@/lib/prisma");
    vi.mocked(prisma.asistencia.count).mockResolvedValue(0 as never);
    vi.mocked(prisma.sesion.count).mockResolvedValue(3 as never);

    const { eliminarClase, ClaseConSesionesError } = await import(
      "@/server/queries/clases"
    );

    const error = await eliminarClase("clase-1").catch((e) => e);

    expect(error).toBeInstanceOf(ClaseConSesionesError);
    expect(error.sesiones).toBe(3);
    expect(error.message).toContain("3 sesión(es) programada(s)");
    expect(error.message).toMatch(/elimina primero esas sesiones/i);
    expect(prisma.clase.delete).not.toHaveBeenCalled();
  });

  it("las asistencias pesan más que las sesiones y se avisan primero", async () => {
    const { prisma } = await import("@/lib/prisma");
    vi.mocked(prisma.asistencia.count).mockResolvedValue(12 as never);
    vi.mocked(prisma.sesion.count).mockResolvedValue(4 as never);

    const { eliminarClase, ClaseConAsistenciasError } = await import(
      "@/server/queries/clases"
    );

    const error = await eliminarClase("clase-1").catch((e) => e);

    expect(error).toBeInstanceOf(ClaseConAsistenciasError);
    expect(error.message).toContain("12 asistencia(s)");
    expect(error.message).toMatch(/respaldo de las constancias/i);
    expect(prisma.clase.delete).not.toHaveBeenCalled();
  });
});
