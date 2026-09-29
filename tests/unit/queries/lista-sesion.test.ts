import { describe, it, expect, vi, beforeEach } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// La lista de una sesión: los niños que asistieron y el staff asignado.
//
// Es lo que el cliente pidió «anexar» a la sesión, y lo que va a consumir el
// agente que genere el Word. Estas pruebas fijan su contrato: qué entra
// (claseId), qué sale (niños + staff + fechas + totales) y, sobre todo, qué NO
// sale — el contacto del staff, que depende de quién pregunta.
// ─────────────────────────────────────────────────────────────────────────────

vi.mock("@/lib/prisma", () => ({
  prisma: {
    clase: { findUnique: vi.fn() },
    inscripcion: { findMany: vi.fn() },
  },
}));

const FECHA_1 = new Date("2026-05-09T00:00:00.000Z");
const FECHA_2 = new Date("2026-05-16T00:00:00.000Z");

const CLASE = {
  id:           "c1",
  nombre:       "Astronomía para todos",
  descripcion:  "Charla con telescopios",
  investigador: "Dr. Juan Pérez",
  edicion:      { id: "e1", anio: 2026, nombre: "Edición 2026" },
  sesiones: [
    {
      id: "f1",
      fecha: FECHA_1,
      temas: "El sistema solar",
      asistencias: [{ inscripcionId: "i1" }, { inscripcionId: "i2" }],
    },
    {
      id: "f2",
      fecha: FECHA_2,
      temas: null,
      // Ana repite; Beto no volvió.
      asistencias: [{ inscripcionId: "i1" }],
    },
  ],
  staff: [
    {
      staff: {
        id: "s1", nombre: "Rocío", apellidos: "Canul",
        telefono: "9997654321", correo: "rocio@cinvestav.mx",
        rol: "BECARIO", institucion: "CINVESTAV Mérida",
      },
    },
    {
      staff: {
        id: "s2", nombre: "Juan", apellidos: "Pérez",
        telefono: "9991112222", correo: "juan@cinvestav.mx",
        rol: "INVESTIGADOR", institucion: "CINVESTAV Mérida",
      },
    },
  ],
};

const INSCRIPCIONES = [
  {
    id: "i1",
    participante: {
      id: "p1", nombre: "Ana", apellidos: "López", edad: 9,
      escuela: "Primaria Juárez", grado: "4°", genero: "FEMENINO", nivel: "Primaria",
    },
  },
  {
    id: "i2",
    participante: {
      id: "p2", nombre: "Beto", apellidos: "Martín", edad: 10,
      escuela: "Primaria Morelos", grado: "5°", genero: "MASCULINO", nivel: "Primaria",
    },
  },
];

async function prepararMocks() {
  const { prisma } = await import("@/lib/prisma");
  vi.mocked(prisma.clase.findUnique).mockResolvedValue(CLASE as never);
  vi.mocked(prisma.inscripcion.findMany).mockResolvedValue(INSCRIPCIONES as never);
  return prisma;
}

describe("obtenerListaDeSesion", () => {
  beforeEach(() => vi.clearAllMocks());

  it("devuelve null cuando la sesión no existe", async () => {
    const { prisma } = await import("@/lib/prisma");
    vi.mocked(prisma.clase.findUnique).mockResolvedValueOnce(null);

    const { obtenerListaDeSesion } = await import("@/server/queries/listas-sesion");
    expect(await obtenerListaDeSesion("nope")).toBeNull();
  });

  it("devuelve los niños asistentes Y el staff asignado en una sola llamada", async () => {
    await prepararMocks();
    const { obtenerListaDeSesion } = await import("@/server/queries/listas-sesion");
    const lista = await obtenerListaDeSesion("c1");

    expect(lista).not.toBeNull();
    expect(lista!.sesion.nombre).toBe("Astronomía para todos");
    expect(lista!.ninos.map((n) => n.apellidos)).toEqual(["López", "Martín"]);
    expect(lista!.staff.map((s) => s.nombre)).toEqual(["Rocío", "Juan"]);
    expect(lista!.totales).toEqual({ ninos: 2, staff: 2, fechas: 2 });
  });

  it("solo pide las inscripciones que de verdad asistieron", async () => {
    const prisma = await prepararMocks();
    const { obtenerListaDeSesion } = await import("@/server/queries/listas-sesion");
    await obtenerListaDeSesion("c1");

    expect(prisma.inscripcion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ["i1", "i2"] } },
      }),
    );
  });

  it("dice en qué fechas vino cada niño: Ana en las dos, Beto en una", async () => {
    await prepararMocks();
    const { obtenerListaDeSesion } = await import("@/server/queries/listas-sesion");
    const lista = await obtenerListaDeSesion("c1");

    const ana  = lista!.ninos.find((n) => n.nombre === "Ana")!;
    const beto = lista!.ninos.find((n) => n.nombre === "Beto")!;

    expect(ana.fechasAsistidas).toEqual([FECHA_1, FECHA_2]);
    expect(beto.fechasAsistidas).toEqual([FECHA_1]);
  });

  it("no repite a un niño que vino a varias fechas de la misma sesión", async () => {
    await prepararMocks();
    const { obtenerListaDeSesion } = await import("@/server/queries/listas-sesion");
    const lista = await obtenerListaDeSesion("c1");

    expect(lista!.ninos.filter((n) => n.nombre === "Ana")).toHaveLength(1);
  });

  it("por omisión OCULTA el contacto del staff", async () => {
    await prepararMocks();
    const { obtenerListaDeSesion } = await import("@/server/queries/listas-sesion");
    const lista = await obtenerListaDeSesion("c1");

    expect(lista!.staff[0].telefono).toBeNull();
    expect(lista!.staff[0].correo).toBeNull();
    // El resto sí: el nombre y el rol son lo que va en el anexo.
    expect(lista!.staff[0].rol).toBe("BECARIO");
    expect(lista!.staff[0].institucion).toBe("CINVESTAV Mérida");
  });

  it("incluye el contacto solo cuando quien llama lo pide explícitamente", async () => {
    await prepararMocks();
    const { obtenerListaDeSesion } = await import("@/server/queries/listas-sesion");
    const lista = await obtenerListaDeSesion("c1", { incluirContactoStaff: true });

    expect(lista!.staff[0].telefono).toBe("9997654321");
    expect(lista!.staff[0].correo).toBe("rocio@cinvestav.mx");
  });

  it("una sesión sin asistencias ni staff devuelve listas vacías, no null", async () => {
    const { prisma } = await import("@/lib/prisma");
    vi.mocked(prisma.clase.findUnique).mockResolvedValueOnce({
      ...CLASE,
      sesiones: [{ id: "f1", fecha: FECHA_1, temas: null, asistencias: [] }],
      staff: [],
    } as never);
    vi.mocked(prisma.inscripcion.findMany).mockResolvedValueOnce([] as never);

    const { obtenerListaDeSesion } = await import("@/server/queries/listas-sesion");
    const lista = await obtenerListaDeSesion("c1");

    expect(lista!.ninos).toEqual([]);
    expect(lista!.staff).toEqual([]);
    expect(lista!.totales).toEqual({ ninos: 0, staff: 0, fechas: 1 });
  });
});
