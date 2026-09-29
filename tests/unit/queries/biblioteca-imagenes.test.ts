import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const prismaMock = {
  clase: { findMany: vi.fn() },
  imagenClase: { findMany: vi.fn(), update: vi.fn() },
  $transaction: vi.fn(),
};

vi.mock("@/server/db", () => ({ prisma: prismaMock }));

vi.mock("@/lib/supabase", () => ({
  getSupabaseAdmin: () => ({
    storage: { from: () => ({ upload: vi.fn(), remove: vi.fn(), download: vi.fn() }) },
  }),
}));

function filaImagen(id: string, claseId: string, orden: number) {
  return {
    id,
    claseId,
    url: `supabase://clases/clases/${claseId}/${id}.webp`,
    storagePath: `clases/${claseId}/${id}.webp`,
    titulo: null,
    mimeType: "image/webp",
    tamano: 1000,
    orden,
    createdAt: new Date("2026-03-01T00:00:00.000Z"),
  };
}

const CLASES_CON_IMAGENES = [
  {
    id: "clase-b",
    nombre: "Robótica",
    investigador: "Dra. Ana",
    sesiones: [{ fecha: new Date("2026-03-14T00:00:00.000Z") }],
    imagenes: [filaImagen("img-b1", "clase-b", 0), filaImagen("img-b2", "clase-b", 1)],
  },
  {
    id: "clase-a",
    nombre: "Astronomía",
    investigador: "Dr. Juan",
    sesiones: [{ fecha: new Date("2026-03-07T00:00:00.000Z") }],
    imagenes: [filaImagen("img-a1", "clase-a", 0)],
  },
  {
    id: "clase-sin-fecha",
    nombre: "Clausura",
    investigador: "Comité",
    sesiones: [],
    imagenes: [],
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://ejemplo.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "clave";
});

// ── La biblioteca agrupa por sesión ───────────────────────────────────────────

describe("listarImagenesDeEdicionPorSesion", () => {
  it("devuelve las fotos agrupadas por sesión, no una lista plana", async () => {
    prismaMock.clase.findMany.mockResolvedValueOnce(CLASES_CON_IMAGENES);

    const { listarImagenesDeEdicionPorSesion } = await import(
      "@/server/queries/imagenes-clase"
    );
    const grupos = await listarImagenesDeEdicionPorSesion("edicion-1");

    expect(grupos).toHaveLength(3);
    expect(grupos.map((g) => g.claseId)).toContain("clase-a");
    const astronomia = grupos.find((g) => g.claseId === "clase-a")!;
    expect(astronomia.nombre).toBe("Astronomía");
    expect(astronomia.imagenes.map((i) => i.id)).toEqual(["img-a1"]);
  });

  it("consulta la base UNA sola vez: no una petición por sesión ni por foto", async () => {
    prismaMock.clase.findMany.mockResolvedValueOnce(CLASES_CON_IMAGENES);

    const { listarImagenesDeEdicionPorSesion } = await import(
      "@/server/queries/imagenes-clase"
    );
    await listarImagenesDeEdicionPorSesion("edicion-1");

    expect(prismaMock.clase.findMany).toHaveBeenCalledTimes(1);
    expect(prismaMock.imagenClase.findMany).not.toHaveBeenCalled();
  });

  it("ordena los grupos por fecha y deja al final las sesiones sin fecha", async () => {
    prismaMock.clase.findMany.mockResolvedValueOnce(CLASES_CON_IMAGENES);

    const { listarImagenesDeEdicionPorSesion } = await import(
      "@/server/queries/imagenes-clase"
    );
    const grupos = await listarImagenesDeEdicionPorSesion("edicion-1");

    expect(grupos.map((g) => g.claseId)).toEqual([
      "clase-a",
      "clase-b",
      "clase-sin-fecha",
    ]);
  });

  it("pide las imágenes de cada sesión ya ordenadas por `orden`", async () => {
    prismaMock.clase.findMany.mockResolvedValueOnce(CLASES_CON_IMAGENES);

    const { listarImagenesDeEdicionPorSesion } = await import(
      "@/server/queries/imagenes-clase"
    );
    await listarImagenesDeEdicionPorSesion("edicion-1");

    const argumentos = prismaMock.clase.findMany.mock.calls[0][0];
    expect(argumentos.where).toEqual({ edicionId: "edicion-1" });
    expect(argumentos.select.imagenes.orderBy[0]).toEqual({ orden: "asc" });
  });

  it("las URLs apuntan al proxy autenticado y nunca sale `supabase://`", async () => {
    prismaMock.clase.findMany.mockResolvedValueOnce(CLASES_CON_IMAGENES);

    const { listarImagenesDeEdicionPorSesion } = await import(
      "@/server/queries/imagenes-clase"
    );
    const grupos = await listarImagenesDeEdicionPorSesion("edicion-1");

    const astronomia = grupos.find((g) => g.claseId === "clase-a")!;
    expect(astronomia.imagenes[0].url).toBe(
      "/api/clases/clase-a/imagenes/img-a1/archivo",
    );
    expect(JSON.stringify(grupos)).not.toContain("supabase://");
    expect(JSON.stringify(grupos)).not.toContain("storagePath");
  });

  it("incluye las sesiones sin fotos para que se vea qué falta por subir", async () => {
    prismaMock.clase.findMany.mockResolvedValueOnce(CLASES_CON_IMAGENES);

    const { listarImagenesDeEdicionPorSesion } = await import(
      "@/server/queries/imagenes-clase"
    );
    const grupos = await listarImagenesDeEdicionPorSesion("edicion-1");

    const clausura = grupos.find((g) => g.claseId === "clase-sin-fecha")!;
    expect(clausura.imagenes).toEqual([]);
    expect(clausura.fecha).toBeNull();
  });
});
