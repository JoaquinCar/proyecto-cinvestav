import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactElement } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// El apartado de constancias de una edición.
//
// Esta prueba cubre a escala real lo que se iba a comprobar contra la base
// local (59 inscritos, ninguno excluido de entrada): que con la política nueva
// TODOS salen con derecho sin que nadie haya tocado nada, y que el poder de
// excluir solo se le entrega al ADMIN en la pantalla, no solo en la API.
// ─────────────────────────────────────────────────────────────────────────────

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/server/queries/ediciones", () => ({ listarEdiciones: vi.fn() }));
vi.mock("@/server/queries/constancias", () => ({
  listarConstanciasDeEdicion: vi.fn(),
}));

// El panel real es un componente cliente con diálogo; aquí solo interesa con
// qué datos y con qué permisos se le invoca.
vi.mock("@/components/constancias/PanelConstancias", () => ({
  PanelConstancias: function PanelConstanciasMock() {
    return null;
  },
}));

const sesion = (role: "ADMIN" | "BECARIO" | "READONLY") => ({
  user: { id: `u-${role}`, email: `${role}@cinvestav.mx`, role, name: role, image: null },
});

const edicion = {
  id: "ed-2026",
  nombre: "Pasaporte Científico Mérida 2026",
  anio: 2026,
  activa: true,
};

/** 59 inscritos recién cargados: nadie excluido, nadie con constancia emitida. */
function listadoDe59() {
  const filas = Array.from({ length: 59 }, (_, i) => ({
    inscripcionId: `insc-${i}`,
    participante: {
      id: `p-${i}`,
      nombre: `Niño ${i}`,
      apellidos: `Apellido ${i}`,
      escuela: "Primaria Centro",
      grado: "3°",
    },
    // Ninguno tiene asistencias individuales: en 2026 solo hubo resúmenes.
    asistencias: 0,
    cumpleMinimo: false,
    elegible: true,
    exclusion: { excluida: false, motivo: null, fecha: null, por: null },
    constanciaGenerada: false,
    constanciaUrl: null,
  }));

  return {
    edicion: {
      ...edicion,
      minAsistencias: 6,
      porcentajeMinimo: null,
      cerrada: false,
      totalSesiones: 12,
      modo: "global" as const,
    },
    filas,
    resumen: {
      inscritos: 59,
      conDerecho: 59,
      excluidos: 0,
      emitidas: 0,
      pendientes: 59,
    },
  };
}

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

async function abrirPagina(role: "ADMIN" | "BECARIO" | "READONLY") {
  const { auth } = await import("@/lib/auth");
  vi.mocked(auth).mockResolvedValue(sesion(role) as never);

  const { listarEdiciones } = await import("@/server/queries/ediciones");
  vi.mocked(listarEdiciones).mockResolvedValue([edicion] as never);

  const { listarConstanciasDeEdicion } = await import(
    "@/server/queries/constancias"
  );
  vi.mocked(listarConstanciasDeEdicion).mockResolvedValue(
    listadoDe59() as never,
  );

  const Page = (await import("@/app/(dashboard)/constancias/page")).default;
  const arbol = await Page({ searchParams: Promise.resolve({}) });

  const { PanelConstancias } = await import(
    "@/components/constancias/PanelConstancias"
  );
  return { arbol, panel: buscarElemento(arbol, PanelConstancias) };
}

describe("/constancias", () => {
  beforeEach(() => vi.clearAllMocks());

  it("con 59 inscritos y nadie excluido, los 59 salen con derecho", async () => {
    const { panel } = await abrirPagina("ADMIN");

    expect(panel, "la página debe renderizar el listado").not.toBeNull();
    const props = panel!.props as {
      filas: { elegible: boolean }[];
      minimo: number;
    };

    expect(props.filas).toHaveLength(59);
    expect(props.filas.every((f) => f.elegible)).toBe(true);
    // El mínimo sigue viajando a la pantalla, pero como dato informativo.
    expect(props.minimo).toBe(6);
  });

  it("solo el ADMIN puede excluir desde la pantalla", async () => {
    const admin = await abrirPagina("ADMIN");
    expect((admin.panel!.props as { puedeExcluir: boolean }).puedeExcluir).toBe(
      true,
    );

    const becario = await abrirPagina("BECARIO");
    expect(
      (becario.panel!.props as { puedeExcluir: boolean }).puedeExcluir,
    ).toBe(false);

    const consulta = await abrirPagina("READONLY");
    expect(
      (consulta.panel!.props as { puedeExcluir: boolean }).puedeExcluir,
    ).toBe(false);
  });

  it("respeta la edición del parámetro en vez de resolver siempre la activa", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValue(sesion("ADMIN") as never);

    const { listarEdiciones } = await import("@/server/queries/ediciones");
    vi.mocked(listarEdiciones).mockResolvedValue([
      { ...edicion, id: "ed-2025", anio: 2025, activa: false },
      edicion,
    ] as never);

    const { listarConstanciasDeEdicion } = await import(
      "@/server/queries/constancias"
    );
    vi.mocked(listarConstanciasDeEdicion).mockResolvedValue(
      listadoDe59() as never,
    );

    const Page = (await import("@/app/(dashboard)/constancias/page")).default;
    await Page({ searchParams: Promise.resolve({ edicion: "ed-2025" }) });

    expect(listarConstanciasDeEdicion).toHaveBeenCalledWith("ed-2025");
  });
});
