import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ─────────────────────────────────────────────────────────────────────
//
// `$transaction` se ejecuta con el mismo mock de cliente: lo que se comprueba es
// que TODAS las escrituras del reordenado pasan por la callback transaccional,
// no que Postgres la honre (eso se verifica punta a punta contra la base local).

const prismaMock = {
  imagenClase: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
  },
  $transaction: vi.fn(),
};

vi.mock("@/server/db", () => ({ prisma: prismaMock }));

vi.mock("@/lib/supabase", () => ({
  getSupabaseAdmin: () => ({
    storage: { from: () => ({ upload: vi.fn(), remove: vi.fn(), download: vi.fn() }) },
  }),
}));

function fila(id: string, orden: number) {
  return {
    id,
    claseId: "clase-1",
    url: `data:image/png;base64,${id}`,
    storagePath: null,
    titulo: null,
    mimeType: "image/png",
    tamano: 100,
    orden,
    createdAt: new Date("2026-03-01T00:00:00.000Z"),
  };
}

/** Estado "heredado": las filas viejas están TODAS en orden = 0. */
const TODAS_EN_CERO = [fila("a", 0), fila("b", 0), fila("c", 0)];

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  prismaMock.$transaction.mockImplementation(
    async (fn: (tx: typeof prismaMock) => unknown) => fn(prismaMock),
  );
  prismaMock.imagenClase.update.mockResolvedValue({});
});

describe("reordenarImagenesDeClase", () => {
  it("persiste el orden pedido como 0,1,2… sin huecos ni empates", async () => {
    prismaMock.imagenClase.findMany
      .mockResolvedValueOnce(TODAS_EN_CERO)
      .mockResolvedValueOnce([fila("c", 0), fila("a", 1), fila("b", 2)]);

    const { reordenarImagenesDeClase } = await import(
      "@/server/queries/imagenes-clase"
    );
    const resultado = await reordenarImagenesDeClase("clase-1", ["c", "a", "b"]);

    // Valores finales escritos, uno por imagen y consecutivos desde 0.
    const finales = prismaMock.imagenClase.update.mock.calls
      .map((c) => c[0] as { where: { id: string }; data: { orden: number } })
      .filter((c) => c.data.orden >= 0);

    expect(finales.map((c) => [c.where.id, c.data.orden])).toEqual([
      ["c", 0],
      ["a", 1],
      ["b", 2],
    ]);
    expect(resultado.map((i) => i.id)).toEqual(["c", "a", "b"]);
  });

  it("escribe en dos fases para no chocar con la unicidad de (claseId, orden)", async () => {
    prismaMock.imagenClase.findMany
      .mockResolvedValueOnce(TODAS_EN_CERO)
      .mockResolvedValueOnce([fila("c", 0), fila("a", 1), fila("b", 2)]);

    const { reordenarImagenesDeClase } = await import(
      "@/server/queries/imagenes-clase"
    );
    await reordenarImagenesDeClase("clase-1", ["c", "a", "b"]);

    const ordenes = prismaMock.imagenClase.update.mock.calls.map(
      (c) => (c[0] as { data: { orden: number } }).data.orden,
    );

    // Primero valores temporales negativos (ninguna fila real los usa), después
    // los definitivos: así ninguna actualización intermedia empata con otra fila.
    expect(ordenes.slice(0, 3).every((o) => o < 0)).toBe(true);
    expect(new Set(ordenes.slice(0, 3)).size).toBe(3);
    expect(ordenes.slice(3)).toEqual([0, 1, 2]);
  });

  it("hace todas las escrituras dentro de una transacción", async () => {
    prismaMock.imagenClase.findMany
      .mockResolvedValueOnce(TODAS_EN_CERO)
      .mockResolvedValueOnce(TODAS_EN_CERO);

    const { reordenarImagenesDeClase } = await import(
      "@/server/queries/imagenes-clase"
    );
    await reordenarImagenesDeClase("clase-1", ["a", "b", "c"]);

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
  });

  it("rechaza una lista con imágenes que no son de esta sesión", async () => {
    prismaMock.imagenClase.findMany.mockResolvedValueOnce(TODAS_EN_CERO);

    const { reordenarImagenesDeClase, OrdenImagenesInvalidoError } = await import(
      "@/server/queries/imagenes-clase"
    );

    await expect(
      reordenarImagenesDeClase("clase-1", ["a", "b", "de-otra-clase"]),
    ).rejects.toBeInstanceOf(OrdenImagenesInvalidoError);
    expect(prismaMock.imagenClase.update).not.toHaveBeenCalled();
  });

  it("rechaza una lista incompleta: dejaría huecos en el orden", async () => {
    prismaMock.imagenClase.findMany.mockResolvedValueOnce(TODAS_EN_CERO);

    const { reordenarImagenesDeClase, OrdenImagenesInvalidoError } = await import(
      "@/server/queries/imagenes-clase"
    );

    await expect(
      reordenarImagenesDeClase("clase-1", ["a", "b"]),
    ).rejects.toBeInstanceOf(OrdenImagenesInvalidoError);
    expect(prismaMock.imagenClase.update).not.toHaveBeenCalled();
  });

  it("rechaza una lista con ids repetidos", async () => {
    prismaMock.imagenClase.findMany.mockResolvedValueOnce(TODAS_EN_CERO);

    const { reordenarImagenesDeClase, OrdenImagenesInvalidoError } = await import(
      "@/server/queries/imagenes-clase"
    );

    await expect(
      reordenarImagenesDeClase("clase-1", ["a", "a", "b"]),
    ).rejects.toBeInstanceOf(OrdenImagenesInvalidoError);
    expect(prismaMock.imagenClase.update).not.toHaveBeenCalled();
  });

  it("devuelve las imágenes ya resueltas para la vista, sin la referencia interna", async () => {
    prismaMock.imagenClase.findMany
      .mockResolvedValueOnce(TODAS_EN_CERO)
      .mockResolvedValueOnce([fila("c", 0), fila("a", 1), fila("b", 2)]);

    const { reordenarImagenesDeClase } = await import(
      "@/server/queries/imagenes-clase"
    );
    const resultado = await reordenarImagenesDeClase("clase-1", ["c", "a", "b"]);

    expect(resultado[0]).not.toHaveProperty("storagePath");
    expect(JSON.stringify(resultado)).not.toContain("supabase://");
  });
});

// ── Alta de imágenes: el orden sigue siendo el siguiente libre ────────────────

describe("crearImagenClase y el orden", () => {
  const PNG_1X1 =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

  it("una imagen nueva se va al final, nunca a un orden ya usado", async () => {
    prismaMock.imagenClase.findFirst.mockResolvedValueOnce({ orden: 7 });
    prismaMock.imagenClase.create.mockImplementationOnce(
      async ({ data }: { data: Record<string, unknown> }) => ({ id: "nueva", ...data }),
    );

    const { crearImagenClase } = await import("@/server/queries/imagenes-clase");
    await crearImagenClase("clase-1", { mimeType: "image/png", data: PNG_1X1 });

    const argumentos = prismaMock.imagenClase.create.mock.calls[0][0];
    expect(argumentos.data.orden).toBe(8);
  });

  it("reintenta si otra subida simultánea se quedó con ese orden", async () => {
    // Dos becarios subiendo a la vez a la misma sesión: el primero gana la
    // carrera y el segundo choca con la unicidad de (claseId, orden).
    const choque = Object.assign(new Error("Unique constraint failed"), {
      code: "P2002",
    });

    prismaMock.imagenClase.findFirst
      .mockResolvedValueOnce({ orden: 3 })
      .mockResolvedValueOnce({ orden: 4 });
    prismaMock.imagenClase.create
      .mockRejectedValueOnce(choque)
      .mockImplementationOnce(
        async ({ data }: { data: Record<string, unknown> }) => ({ id: "nueva", ...data }),
      );

    const { crearImagenClase } = await import("@/server/queries/imagenes-clase");
    const creada = await crearImagenClase("clase-1", {
      mimeType: "image/png",
      data: PNG_1X1,
    });

    expect(prismaMock.imagenClase.create).toHaveBeenCalledTimes(2);
    expect(creada.orden).toBe(5);
  });
});
