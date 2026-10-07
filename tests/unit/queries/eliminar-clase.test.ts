import { describe, it, expect, vi, beforeEach } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// Eliminar una sesión (el modelo `Clase`).
//
// Historia del caso: el guardia «tiene N fecha(s) programada(s)» se escribió
// cuando una `Clase` podía existir sin ninguna `Sesion`. Desde que crearla crea
// también su fecha en la misma transacción, TODA clase tiene al menos una, así
// que ese guardia saltaba siempre y ninguna sesión se podía borrar jamás — ni
// una recién creada por error y vacía. Eso es lo que reportó QA.
//
// Lo que se prueba aquí es el reparto nuevo:
//   · La fecha (`Sesion`) se va con la sesión: no significa nada sin ella.
//   · Las imágenes y las asignaciones de staff caen en cascada desde `Clase`.
//   · Las asistencias NO se borran solas: son el respaldo de las constancias.
//     Se pide confirmación (`forzar`) y entonces se borran en la transacción.
//   · El resumen importado del Excel tampoco se pierde en silencio: avisa.
// ─────────────────────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => {
  const db = {
    clase:         { findUnique: vi.fn(), delete: vi.fn() },
    sesion:        { count: vi.fn(), deleteMany: vi.fn() },
    asistencia:    { count: vi.fn(), findMany: vi.fn(), deleteMany: vi.fn() },
    resumenSesion: { count: vi.fn() },
    imagenClase:   { count: vi.fn() },
  };
  return { db };
});

vi.mock("@/lib/prisma", () => ({
  prisma: {
    ...mocks.db,
    // Transacción interactiva: la consulta real cuenta y borra dentro de ella,
    // así que el mock le pasa el mismo objeto como `tx`.
    $transaction: vi.fn((cb: (tx: typeof mocks.db) => unknown) => cb(mocks.db)),
  },
}));

const { db } = mocks;

/** Deja la base simulada con la foto que describan los conteos. */
function sembrar(opciones: {
  nombre?: string;
  fechas?: number;
  asistencias?: number;
  participantes?: number;
  resumenes?: number;
  imagenes?: number;
} = {}) {
  const {
    nombre        = "Sesión de prueba",
    fechas        = 1,
    asistencias   = 0,
    participantes = 0,
    resumenes     = 0,
    imagenes      = 0,
  } = opciones;

  db.clase.findUnique.mockResolvedValue({ id: "clase-1", nombre } as never);
  db.sesion.count.mockResolvedValue(fechas as never);
  db.asistencia.count.mockResolvedValue(asistencias as never);
  db.asistencia.findMany.mockResolvedValue(
    Array.from({ length: participantes }, (_, i) => ({
      inscripcionId: `insc-${i}`,
    })) as never,
  );
  db.resumenSesion.count.mockResolvedValue(resumenes as never);
  db.imagenClase.count.mockResolvedValue(imagenes as never);
  db.clase.delete.mockResolvedValue({ id: "clase-1", nombre } as never);
  db.sesion.deleteMany.mockResolvedValue({ count: fechas } as never);
  db.asistencia.deleteMany.mockResolvedValue({ count: asistencias } as never);
}

describe("eliminarClase", () => {
  beforeEach(() => vi.clearAllMocks());

  // ── El caso que reportó QA ────────────────────────────────────────────────

  it("borra una sesión recién creada: tiene su fecha, pero nada dentro", async () => {
    sembrar({ fechas: 1 });

    const { eliminarClase } = await import("@/server/queries/clases");
    await expect(eliminarClase("clase-1")).resolves.toMatchObject({ id: "clase-1" });

    // La fecha se va con la sesión, sin que nadie la borre antes a mano.
    expect(db.sesion.deleteMany).toHaveBeenCalledWith({
      where: { claseId: "clase-1" },
    });
    expect(db.clase.delete).toHaveBeenCalledWith({ where: { id: "clase-1" } });
    // Sin asistencias no hay nada de historial que tocar.
    expect(db.asistencia.deleteMany).not.toHaveBeenCalled();
  });

  it("tener fechas programadas ya no es motivo para rechazar el borrado", async () => {
    sembrar({ fechas: 3 });

    const { eliminarClase } = await import("@/server/queries/clases");
    await expect(eliminarClase("clase-1")).resolves.toBeTruthy();
    expect(db.clase.delete).toHaveBeenCalled();
  });

  // ── Lo que sí se protege ──────────────────────────────────────────────────

  it("no se lleva por delante el historial de asistencia sin confirmación", async () => {
    sembrar({ nombre: "Robótica", fechas: 1, asistencias: 12, participantes: 9 });

    const { eliminarClase, ClaseConAsistenciasError } = await import(
      "@/server/queries/clases"
    );

    const error = await eliminarClase("clase-1").catch((e) => e);

    expect(error).toBeInstanceOf(ClaseConAsistenciasError);
    expect(error.conteos).toMatchObject({ asistencias: 12, participantes: 9 });
    // El mensaje nombra la sesión, dice qué se perdería y qué hacer ahora.
    expect(error.message).toContain("Robótica");
    expect(error.message).toContain("12");
    expect(error.message).toContain("9");
    expect(error.message).toMatch(/constancia/i);
    expect(error.message).toMatch(/confirma/i);
    // Y no dice "tiene 1 fecha programada", que no le sirve a nadie.
    expect(error.message).not.toMatch(/fecha\(s\) programada/i);

    expect(db.clase.delete).not.toHaveBeenCalled();
    expect(db.sesion.deleteMany).not.toHaveBeenCalled();
    expect(db.asistencia.deleteMany).not.toHaveBeenCalled();
  });

  it("avisa antes de perder el resumen que vino del Excel del organizador", async () => {
    sembrar({ nombre: "Clausura", fechas: 1, asistencias: 0, resumenes: 1 });

    const { eliminarClase, ClaseConAsistenciasError } = await import(
      "@/server/queries/clases"
    );

    const error = await eliminarClase("clase-1").catch((e) => e);

    expect(error).toBeInstanceOf(ClaseConAsistenciasError);
    expect(error.conteos).toMatchObject({ resumenes: 1 });
    expect(error.message).toContain("Clausura");
    expect(error.message).toMatch(/excel/i);
    expect(error.message).toMatch(/import/i);
    expect(db.clase.delete).not.toHaveBeenCalled();
  });

  // ── Confirmado por un ADMIN ───────────────────────────────────────────────

  it("con forzar borra asistencias, fechas y sesión, todo en la misma transacción", async () => {
    sembrar({ fechas: 2, asistencias: 12, participantes: 9, resumenes: 1 });

    const { prisma } = await import("@/lib/prisma");
    const { eliminarClase } = await import("@/server/queries/clases");

    await expect(eliminarClase("clase-1", { forzar: true })).resolves.toBeTruthy();

    expect(db.asistencia.deleteMany).toHaveBeenCalledWith({
      where: { sesion: { claseId: "clase-1" } },
    });
    expect(db.sesion.deleteMany).toHaveBeenCalledWith({
      where: { claseId: "clase-1" },
    });
    expect(db.clase.delete).toHaveBeenCalledWith({ where: { id: "clase-1" } });
    // Una sola transacción: o se va todo, o no se va nada.
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  // ── Bordes ────────────────────────────────────────────────────────────────

  it("no finge haber borrado una sesión que ya no está", async () => {
    sembrar();
    db.clase.findUnique.mockResolvedValue(null as never);

    const { eliminarClase, ClaseNoEncontradaError } = await import(
      "@/server/queries/clases"
    );

    await expect(eliminarClase("clase-fantasma")).rejects.toBeInstanceOf(
      ClaseNoEncontradaError,
    );
    expect(db.clase.delete).not.toHaveBeenCalled();
  });
});
