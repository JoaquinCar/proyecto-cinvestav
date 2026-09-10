import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactElement } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// El reporte de una edición debe ser el de ESA edición.
//
// Defecto original: /ediciones/[id]/reportes ignoraba el `id` y redirigía a
// /estadisticas, que resolvía por edición activa. Pedir el reporte de 2026
// estando activa 2027 mostraba el de 2027.
// ─────────────────────────────────────────────────────────────────────────────

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/server/queries/ediciones", () => ({
  obtenerEdicionPorId: vi.fn(),
  listarEdiciones: vi.fn(),
}));
vi.mock("@/server/queries/estadisticas", () => ({
  obtenerAnalisisProfundo: vi.fn(),
}));
vi.mock("@/server/queries/historico", () => ({
  obtenerHistoricoEdiciones: vi.fn(),
}));

// El panel real arrastra Recharts y componentes cliente; aquí solo interesa con
// qué edición se le invoca.
vi.mock("@/components/estadisticas/AnalisisEdicion", () => ({
  AnalisisEdicion: function AnalisisEdicionMock() {
    return null;
  },
}));

const sessionAdmin = {
  user: { id: "u1", email: "a@c.mx", role: "ADMIN", name: "A", image: null },
};

const edicion2026 = {
  id: "ed-2026",
  anio: 2026,
  nombre: "Pasaporte Científico Mérida 2026",
  fechaInicio: new Date("2026-01-24"),
  fechaFin: new Date("2026-06-27"),
  minAsistencias: 6,
  porcentajeMinimo: null,
  asistenciaGlobal: true,
  activa: false,
  cerrada: false,
  createdAt: new Date("2026-01-01"),
  _count: { inscripciones: 51, clases: 12 },
  sesionesTotal: 12,
  sesionesConDatos: 12,
};

const edicion2027 = {
  ...edicion2026,
  id: "ed-2027",
  anio: 2027,
  nombre: "Pasaporte Científico Mérida 2027",
  activa: true,
};

/** Busca el primer elemento del árbol cuyo `type` sea el componente dado. */
function buscarElemento(nodo: unknown, tipo: unknown): ReactElement | null {
  if (!nodo || typeof nodo !== "object") return null;
  if (Array.isArray(nodo)) {
    for (const hijo of nodo) {
      const encontrado = buscarElemento(hijo, tipo);
      if (encontrado) return encontrado;
    }
    return null;
  }
  const el = nodo as ReactElement<{ children?: unknown }>;
  if (el.type === tipo) return el;
  const children = el.props?.children;
  return children ? buscarElemento(children, tipo) : null;
}

describe("/ediciones/[id]/reportes", () => {
  beforeEach(() => vi.clearAllMocks());

  it("pide el análisis de la edición del URL, no el de la activa", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValue(sessionAdmin as never);

    const { obtenerEdicionPorId } = await import("@/server/queries/ediciones");
    vi.mocked(obtenerEdicionPorId).mockResolvedValue(edicion2026 as never);

    const { AnalisisEdicion } = await import(
      "@/components/estadisticas/AnalisisEdicion"
    );
    const Page = (await import("@/app/(dashboard)/ediciones/[id]/reportes/page"))
      .default;

    const arbol = await Page({ params: Promise.resolve({ id: "ed-2026" }) });

    // Se consultó la edición pedida, no la activa.
    expect(obtenerEdicionPorId).toHaveBeenCalledWith("ed-2026");

    const panel = buscarElemento(arbol, AnalisisEdicion);
    expect(panel, "la página debe renderizar el panel de análisis").not.toBeNull();
    expect((panel!.props as { edicionId: string }).edicionId).toBe("ed-2026");
  });

  it("404 cuando la edición no existe", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValue(sessionAdmin as never);

    const { obtenerEdicionPorId } = await import("@/server/queries/ediciones");
    vi.mocked(obtenerEdicionPorId).mockResolvedValue(null as never);

    const Page = (await import("@/app/(dashboard)/ediciones/[id]/reportes/page"))
      .default;

    // notFound() lanza una excepción especial de Next.
    await expect(
      Page({ params: Promise.resolve({ id: "no-existe" }) }),
    ).rejects.toThrow();
  });
});

describe("/estadisticas", () => {
  beforeEach(() => vi.clearAllMocks());

  it("respeta ?edicion= aunque haya otra edición activa", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValue(sessionAdmin as never);

    const { listarEdiciones } = await import("@/server/queries/ediciones");
    vi.mocked(listarEdiciones).mockResolvedValue([
      edicion2027,
      edicion2026,
    ] as never);

    const { AnalisisEdicion } = await import(
      "@/components/estadisticas/AnalisisEdicion"
    );
    const Page = (await import("@/app/(dashboard)/estadisticas/page")).default;

    const arbol = await Page({
      searchParams: Promise.resolve({ edicion: "ed-2026" }),
    });

    const panel = buscarElemento(arbol, AnalisisEdicion);
    expect(panel).not.toBeNull();
    expect((panel!.props as { edicionId: string }).edicionId).toBe("ed-2026");
  });

  it("sin parámetro usa la edición activa", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValue(sessionAdmin as never);

    const { listarEdiciones } = await import("@/server/queries/ediciones");
    vi.mocked(listarEdiciones).mockResolvedValue([
      edicion2027,
      edicion2026,
    ] as never);

    const { AnalisisEdicion } = await import(
      "@/components/estadisticas/AnalisisEdicion"
    );
    const Page = (await import("@/app/(dashboard)/estadisticas/page")).default;

    const arbol = await Page({ searchParams: Promise.resolve({}) });

    const panel = buscarElemento(arbol, AnalisisEdicion);
    expect(panel).not.toBeNull();
    expect((panel!.props as { edicionId: string }).edicionId).toBe("ed-2027");
  });
});
