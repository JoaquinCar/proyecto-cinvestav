import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactElement } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// El acompañante se edita desde la ficha del participante, y SIEMPRE dentro de
// la edición a la que pertenece.
//
// El acompañante no es del niño: es de su inscripción de ese año. Un niño que
// lleva tres ediciones tiene tres acompañantes posibles —mamá en 2026, abuela
// en 2027— y las tres cosas deben poder tocarse por separado. Lo que estas
// pruebas protegen es justo eso: que haya un apartado POR edición, con el
// nombre de la edición a la vista, y nunca uno solo que edite «la actual» a
// ciegas.
// ─────────────────────────────────────────────────────────────────────────────

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/server/queries/participantes", () => ({
  obtenerHistorialParticipante: vi.fn(),
}));

// El gestor real es un componente cliente; aquí solo importa con qué datos y
// con qué permisos se le invoca.
vi.mock("@/components/acompanantes/GestorAcompanante", () => ({
  GestorAcompanante: function GestorAcompananteMock() {
    return null;
  },
}));

// Los otros botones de la ficha son de cliente y usan hooks: ejecutarlos al
// recorrer el árbol solo ensuciaría la salida con avisos de React.
vi.mock("@/components/constancias/BotonConstancia", () => ({
  BotonConstancia: function BotonConstanciaMock() {
    return null;
  },
}));
vi.mock("@/components/participantes/BotonBajaInscripcion", () => ({
  BotonBajaInscripcion: function BotonBajaInscripcionMock() {
    return null;
  },
}));

const sesion = (role: "ADMIN" | "BECARIO" | "READONLY") => ({
  user: { id: `u-${role}`, email: `${role}@cinvestav.mx`, role, name: role, image: null },
});

const LAURA = {
  id: "ac-laura",
  nombre: "Laura",
  apellidos: "Pérez",
  telefono: "9991234567",
  correo: "laura@example.com",
  parentesco: "MADRE" as const,
  // Acompaña también al hermano: por eso quitarla de aquí no puede borrarla.
  _count: { inscripciones: 2 },
};

/** Un niño con dos ediciones: en 2027 vino con Laura, en 2026 vino solo. */
function historialDeDosEdiciones() {
  return {
    id: "p-1",
    nombre: "Ana",
    apellidos: "Gómez",
    edad: 9,
    escuela: "Primaria Centro",
    grado: "4° primaria",
    inscripciones: [
      {
        id: "insc-2026",
        constanciaGenerada: false,
        constanciaUrl: null,
        constanciaExcluida: false,
        constanciaMotivoExclusion: null,
        acompanante: null,
        edicion: {
          id: "ed-2026",
          anio: 2026,
          nombre: "Pasaporte Científico Mérida 2026",
          activa: false,
          minAsistencias: 6,
          porcentajeMinimo: null,
        },
        asistencias: [],
      },
      {
        id: "insc-2027",
        constanciaGenerada: false,
        constanciaUrl: null,
        constanciaExcluida: false,
        constanciaMotivoExclusion: null,
        acompanante: LAURA,
        edicion: {
          id: "ed-2027",
          anio: 2027,
          nombre: "Pasaporte Científico Mérida 2027",
          activa: true,
          minAsistencias: 6,
          porcentajeMinimo: null,
        },
        asistencias: [],
      },
    ],
  };
}

/**
 * Todos los elementos del árbol cuyo `type` sea el componente dado.
 *
 * La página arma cada edición dentro de un componente propio, así que no basta
 * con recorrer `children`: hay que ejecutar los componentes intermedios. Los
 * que no se dejan (los de cliente, con hooks) se saltan sin romper la búsqueda.
 */
function buscarTodos(
  nodo: unknown,
  tipo: unknown,
  acc: ReactElement[] = [],
  profundidad = 0,
): ReactElement[] {
  if (!nodo || typeof nodo !== "object" || profundidad > 40) return acc;
  if (Array.isArray(nodo)) {
    for (const hijo of nodo) buscarTodos(hijo, tipo, acc, profundidad + 1);
    return acc;
  }
  const el = nodo as ReactElement<{ children?: unknown }>;
  if (el.type === tipo) {
    acc.push(el);
    return acc;
  }
  if (typeof el.type === "function") {
    try {
      const render = el.type as (props: unknown) => unknown;
      buscarTodos(render(el.props), tipo, acc, profundidad + 1);
    } catch {
      // Componente de cliente: no se puede ejecutar aquí y no estorba.
    }
    return acc;
  }
  const children = el.props?.children;
  if (children) buscarTodos(children, tipo, acc, profundidad + 1);
  return acc;
}

type PropsGestor = {
  inscripcionId: string;
  acompanante: typeof LAURA | null;
  puedeEditar: boolean;
  puedeVerContacto: boolean;
  edicionNombre: string;
};

async function abrirPerfil(role: "ADMIN" | "BECARIO" | "READONLY") {
  const { auth } = await import("@/lib/auth");
  vi.mocked(auth).mockResolvedValue(sesion(role) as never);

  const { obtenerHistorialParticipante } = await import(
    "@/server/queries/participantes"
  );
  vi.mocked(obtenerHistorialParticipante).mockResolvedValue(
    historialDeDosEdiciones() as never,
  );

  const Page = (await import("@/app/(dashboard)/participantes/[id]/page")).default;
  const arbol = await Page({ params: Promise.resolve({ id: "p-1" }) });

  const { GestorAcompanante } = await import(
    "@/components/acompanantes/GestorAcompanante"
  );
  const gestores = buscarTodos(arbol, GestorAcompanante);
  return gestores.map((g) => g.props as PropsGestor);
}

describe("acompañante editable desde la ficha del participante", () => {
  beforeEach(() => vi.clearAllMocks());

  it("hay un apartado por edición, cada uno con SU inscripción", async () => {
    const gestores = await abrirPerfil("ADMIN");

    expect(gestores).toHaveLength(2);
    // Del año más reciente al más antiguo, como el resto del historial.
    expect(gestores.map((g) => g.inscripcionId)).toEqual([
      "insc-2027",
      "insc-2026",
    ]);
  });

  it("cada apartado dice de qué edición habla, para no editar a ciegas", async () => {
    const gestores = await abrirPerfil("ADMIN");

    expect(gestores[0].edicionNombre).toBe("Pasaporte Científico Mérida 2027");
    expect(gestores[1].edicionNombre).toBe("Pasaporte Científico Mérida 2026");
  });

  it("una edición sin acompañante también se puede capturar después", async () => {
    const gestores = await abrirPerfil("ADMIN");

    // 2026 quedó sin acompañante al inscribir: el hueco que se viene a tapar.
    expect(gestores[1].acompanante).toBeNull();
    expect(gestores[1].puedeEditar).toBe(true);
  });

  it("ADMIN y BECARIO capturan; READONLY solo consulta", async () => {
    expect((await abrirPerfil("ADMIN")).every((g) => g.puedeEditar)).toBe(true);
    expect((await abrirPerfil("BECARIO")).every((g) => g.puedeEditar)).toBe(true);
    expect((await abrirPerfil("READONLY")).some((g) => g.puedeEditar)).toBe(false);
  });

  it("READONLY no ve el teléfono del adulto, igual que en el API", async () => {
    // GET /api/acompanantes/[id] se lo oculta a este rol a propósito. Si la
    // ficha del niño lo pintara igual, el candado del API no serviría de nada.
    expect((await abrirPerfil("READONLY")).every((g) => g.puedeVerContacto)).toBe(
      false,
    );
    expect((await abrirPerfil("BECARIO")).every((g) => g.puedeVerContacto)).toBe(
      true,
    );
  });

  it("el apartado sabe a cuántos niños acompaña la ficha compartida", async () => {
    const gestores = await abrirPerfil("ADMIN");

    // Es el dato que permite avisar «también acompaña a su hermano» antes de
    // quitarla. Si no llega hasta la pantalla, el aviso no se puede dar.
    expect(gestores[0].acompanante?._count?.inscripciones).toBe(2);
  });
});
