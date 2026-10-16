import { describe, it, expect, vi, beforeEach } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// Borrar una edición tiene que hacerlo TODO por la conexión de la transacción.
//
// Este fallo no se ve en local y solo mata en producción, que es la peor clase
// de fallo. `contarArrastreDeEdicion` se escribió usando el cliente global de
// Prisma mientras la transacción ya retenía una conexión: eso pide una SEGUNDA
// conexión al pozo. En una máquina de desarrollo el pozo es amplio y la base
// está a menos de un milisegundo, así que pasa desapercibido; en Vercel contra
// Supabase, con el pozo al mínimo, esa segunda conexión puede no llegar y la
// transacción muere esperándola. El coordinador solo veía «No se pudo eliminar
// la edición», con el borrado funcionando perfectamente si se probaba a mano.
//
// Por eso la prueba no mira el resultado: mira POR DÓNDE viajan las consultas.
// ─────────────────────────────────────────────────────────────────────────────

const global_ = {
  inscripcion: { count: vi.fn(), deleteMany: vi.fn() },
  clase: { count: vi.fn(), deleteMany: vi.fn() },
  sesion: { count: vi.fn(), deleteMany: vi.fn() },
  asistencia: { count: vi.fn(), deleteMany: vi.fn(), findMany: vi.fn() },
  edicion: { findUnique: vi.fn(), delete: vi.fn() },
  $transaction: vi.fn(),
};

vi.mock("@/server/db", () => ({ prisma: global_ }));

/** El cliente que Prisma entrega dentro de `$transaction`. */
function clienteDeTransaccion() {
  return {
    inscripcion: { count: vi.fn(async () => 0), deleteMany: vi.fn() },
    clase: { count: vi.fn(async () => 3), deleteMany: vi.fn() },
    sesion: { count: vi.fn(async () => 3), deleteMany: vi.fn() },
    asistencia: {
      count: vi.fn(async () => 0),
      deleteMany: vi.fn(),
      findMany: vi.fn(async () => []),
    },
    edicion: {
      findUnique: vi.fn(async () => ({ id: "ed-1", nombre: "Pasaporte 2027" })),
      delete: vi.fn(async () => ({ id: "ed-1" })),
    },
  };
}

describe("eliminarEdicion — todo por la conexión de la transacción", () => {
  beforeEach(() => vi.clearAllMocks());

  it("no usa el cliente global dentro de la transacción", async () => {
    const tx = clienteDeTransaccion();
    global_.$transaction.mockImplementation(async (fn: (c: unknown) => unknown) =>
      fn(tx),
    );

    const { eliminarEdicion } = await import("@/server/queries/ediciones");
    await eliminarEdicion("ed-1");

    // Lo que de verdad se protege: ni un solo `prisma.*` suelto ahí dentro.
    // Cada uno pediría una conexión extra que en producción puede no llegar.
    for (const [nombre, modelo] of Object.entries(global_)) {
      if (nombre === "$transaction") continue;
      for (const [metodo, fn] of Object.entries(modelo)) {
        expect(
          (fn as ReturnType<typeof vi.fn>).mock.calls.length,
          `prisma.${nombre}.${metodo}() se llamó con el cliente global dentro de la transacción`,
        ).toBe(0);
      }
    }

    // Y que sí se hizo el trabajo, por el camino bueno.
    expect(tx.inscripcion.count).toHaveBeenCalled();
    expect(tx.asistencia.count).toHaveBeenCalled();
    expect(tx.edicion.delete).toHaveBeenCalledWith({ where: { id: "ed-1" } });
  });

  it("le da aire a la transacción, que la base está al otro lado de internet", async () => {
    const tx = clienteDeTransaccion();
    global_.$transaction.mockImplementation(async (fn: (c: unknown) => unknown) =>
      fn(tx),
    );

    const { eliminarEdicion } = await import("@/server/queries/ediciones");
    await eliminarEdicion("ed-1");

    // Los 5 s por omisión de Prisma se pensaron para una base local. Aquí cada
    // ida y vuelta cuesta ~100 ms y una edición entera son varias: una
    // transacción agotada deja el borrado a medias.
    const opciones = global_.$transaction.mock.calls[0]?.[1] as
      | { timeout?: number; maxWait?: number }
      | undefined;
    expect(opciones?.timeout ?? 5_000).toBeGreaterThan(5_000);
  });
});
