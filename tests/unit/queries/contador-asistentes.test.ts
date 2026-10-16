import { describe, it, expect, vi, beforeEach } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// EL CONTADOR DE LAS TARJETAS CUENTA PRESENTES, NO FILAS.
//
// Reporte del coordinador, literal: «si yo paso lista y luego quito a unos
// niños y los pongo como ausentes, el contador de fuera los sigue contando y
// sumando. Puede que por fuera haya 7, pero por dentro solo 3 están como
// presentes (y los 4 que quité para ver si funcionaba bien)».
//
// Reproducido contra la base de QA antes de arreglarlo: 7 fuera, 3 dentro, y
// en la base 3 filas con `presente = true` y 4 con `presente = false`.
//
// La causa: `Asistencia` guarda TAMBIÉN a los ausentes —marcar ausente no
// borra la fila, le pone `presente = false` (ver el modelo en schema.prisma)—.
// Un `_count` pelado cuenta las filas, así que marcar a un niño como ausente
// SUMABA uno al contador de fuera. Dentro, `obtenerResumenAsistencia` sí
// filtraba por `presente: true`, y de ahí el 7 contra 3.
//
// Lo que se fija aquí es que las consultas que alimentan un número con la
// etiqueta «asistentes» filtren por presente. No se comprueba el resultado
// —eso es la prueba contra base de tests/integration/db/— sino el `select`
// que se le manda a Prisma, que es donde estaba el defecto.
//
// OJO con lo que NO entra aquí: `contarArrastreDeClase` (el aviso de «esto se
// va a borrar») cuenta FILAS a propósito, ausentes incluidos, porque habla de
// cuántos registros se pierden. Ahí un filtro por presente sería el error.
// ─────────────────────────────────────────────────────────────────────────────

vi.mock("@/server/db", () => ({
  prisma: {
    clase:  { findMany: vi.fn().mockResolvedValue([]) },
    sesion: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));

/**
 * Busca, a cualquier profundidad de los argumentos que se le pasan a Prisma,
 * el `_count` de asistencias y devuelve su `where`.
 *
 * Va a ciegas por el árbol a propósito: el `_count` de las tarjetas cuelga de
 * `select.sesiones.select` y el de la página de la sesión de `select`, y lo
 * que importa es el filtro, no dónde esté anidado.
 */
function filtroDelConteo(args: unknown): unknown {
  if (!args || typeof args !== "object") return undefined;

  const nodo = args as Record<string, unknown>;

  const conteo = nodo._count as
    | { select?: { asistencias?: { where?: unknown } } }
    | undefined;
  if (conteo?.select && "asistencias" in conteo.select) {
    // `asistencias: true` (sin filtro) devuelve undefined, que es el fallo.
    return conteo.select.asistencias?.where;
  }

  for (const valor of Object.values(nodo)) {
    const encontrado = filtroDelConteo(valor);
    if (encontrado !== undefined) return encontrado;
  }
  return undefined;
}

describe("el contador de «asistentes» cuenta solo a los presentes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("listarClasesConSesiones (tarjetas del panel de asistencia)", async () => {
    const { prisma } = await import("@/server/db");
    const { listarClasesConSesiones } = await import("@/server/queries/clases");

    await listarClasesConSesiones("edicion-1");

    const args = vi.mocked(prisma.clase.findMany).mock.calls[0]![0];

    expect(
      filtroDelConteo(args),
      "el _count de la tarjeta tiene que filtrar por presente: si no, marcar " +
        "ausente a un niño SUMA al contador de fuera",
    ).toEqual({ presente: true });
  });

  it("listarSesionesDeClase (el «N asistentes» de la página de la sesión)", async () => {
    const { prisma } = await import("@/server/db");
    const { listarSesionesDeClase } = await import("@/server/queries/clases");

    await listarSesionesDeClase("clase-1");

    const args = vi.mocked(prisma.sesion.findMany).mock.calls[0]![0];

    expect(
      filtroDelConteo(args),
      "la página de la sesión enseña el mismo número con la etiqueta " +
        "«asistentes»: tiene que contar lo mismo que el panel",
    ).toEqual({ presente: true });
  });
});
