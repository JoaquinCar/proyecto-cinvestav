import { describe, it, expect, vi, beforeEach } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// SESIONES REGISTRADAS vs. ASISTENCIA CAPTURADA
//
// Defecto reportado por QA: el dashboard decía «Sesiones impartidas 0/7» en una
// edición cuyas siete sesiones se habían creado en la aplicación, y «7/12» en
// 2026. El número salía de contar únicamente las sesiones con `ResumenSesion`
// —los totales agregados que solo entran importando el Excel del organizador—,
// así que nada de lo que se hacía en la aplicación lo movía. QA lo resumió:
// «no sé qué activa las sesiones».
//
// Lo que hay ahora son DOS métricas, porque eran dos preguntas distintas:
//
//   • «Sesiones registradas» — cuántas existen. Un conteo, sin fracción: una
//     sesión cuenta desde que se crea, sin esperar fecha ni captura.
//   • «Asistencia capturada» — N de esas tienen asistencia registrada, del
//     Excel o de la lista individual. Esta sí es fracción, y es la única que se
//     mueve: le dice al coordinador qué trabajo le falta.
// ─────────────────────────────────────────────────────────────────────────────

vi.mock("@/lib/prisma", () => ({
  prisma: {
    sesion: { findMany: vi.fn(), count: vi.fn() },
    inscripcion: { findMany: vi.fn(), count: vi.fn() },
    clase: { findMany: vi.fn() },
    edicion: { findUnique: vi.fn() },
  },
}));

/** Fecha de calendario como la guarda la aplicación: medianoche UTC. */
const dia = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
/** Fecha de calendario como la guarda el importador del Excel: mediodía UTC. */
const diaExcel = (iso: string) => new Date(`${iso}T12:00:00.000Z`);

type Nino = { genero: "FEMENINO" | "MASCULINO" | null; edad: number; nivel: string | null };

const nina = (edad = 9, nivel = "PRIMARIA"): Nino => ({ genero: "FEMENINO", edad, nivel });
const nino = (edad = 10, nivel = "PRIMARIA"): Nino => ({ genero: "MASCULINO", edad, nivel });

function agregado(total: number, ninas = 0, ninos = 0) {
  return {
    ninas,
    ninos,
    total,
    mamas: 0,
    papas: 0,
    preescolar: 0,
    primaria: total,
    secundaria: 0,
    mediaSuperior: 0,
    porEdad: null,
  };
}

/** Una fila tal como la devuelve `prisma.sesion.findMany` en estadisticas.ts. */
function sesion({
  fecha = dia("2026-09-26"),
  nombre = "Astronomía",
  resumen = null as ReturnType<typeof agregado> | null,
  lista = [] as Nino[],
} = {}) {
  return {
    fecha,
    temas: null,
    clase: { nombre },
    resumen,
    asistencias: lista.map((participante) => ({ inscripcion: { participante } })),
  };
}

async function metricas(sesiones: ReturnType<typeof sesion>[]) {
  const { prisma } = await import("@/lib/prisma");
  vi.mocked(prisma.sesion.findMany).mockResolvedValue(sesiones as never);
  const { obtenerMetricasAsistencia } = await import("@/server/queries/estadisticas");
  return obtenerMetricasAsistencia("ed-1");
}

describe("obtenerMetricasAsistencia — sesiones registradas", () => {
  beforeEach(() => vi.clearAllMocks());

  it("una sesión recién creada, con fecha FUTURA y sin captura, ya cuenta", async () => {
    // Es literalmente el caso que reportó QA: creó sus sesiones de prueba y el
    // dashboard le decía 0. La fecha no interviene; existir basta.
    const m = await metricas([
      sesion({ fecha: dia("2099-06-09") }),
      sesion({ fecha: dia("2099-09-06") }),
    ]);

    expect(m.totalSesiones).toBe(2);
    expect(m.sesionesCapturadas).toBe(0);
    expect(m.sesionesSinCapturar).toBe(2);
  });

  it("da igual la fecha: pasada, de hoy o futura, todas se registran igual", async () => {
    const m = await metricas([
      sesion({ fecha: dia("2020-01-01") }),
      sesion({ fecha: dia("2099-12-31") }),
      sesion({ fecha: diaExcel("2026-05-09") }),
    ]);

    expect(m.totalSesiones).toBe(3);
  });

  it("sin ninguna sesión, todo en cero y sin dividir entre cero", async () => {
    const m = await metricas([]);

    expect(m.totalSesiones).toBe(0);
    expect(m.sesionesCapturadas).toBe(0);
    expect(m.sesionesSinCapturar).toBe(0);
    expect(m.promedioPorSesion).toBe(0);
    expect(m.picoSesion).toBe(0);
  });
});

describe("obtenerMetricasAsistencia — asistencia capturada", () => {
  beforeEach(() => vi.clearAllMocks());

  it("distingue agregado del Excel, lista individual y sin nada", async () => {
    const m = await metricas([
      sesion({ nombre: "Del Excel", resumen: agregado(31, 16, 15) }),
      sesion({ nombre: "Solo lista", lista: [nina(), nina(8), nino()] }),
      sesion({ nombre: "Sin capturar" }),
    ]);

    expect(m.totalSesiones).toBe(3);
    expect(m.sesionesCapturadas).toBe(2);
    expect(m.sesionesConAgregado).toBe(1);
    expect(m.sesionesConLista).toBe(1);
    expect(m.sesionesSinCapturar).toBe(1);
  });

  it("la lista pasada en la aplicación alimenta el panel, no solo el Excel", async () => {
    // Antes del arreglo, una edición capturada entera en la app mostraba el
    // panel de asistencia completo en cero: solo se miraba `ResumenSesion`.
    const m = await metricas([sesion({ lista: [nina(), nina(8), nino()] })]);

    expect(m.sesionesCapturadas).toBe(1);
    expect(m.sesionesConLista).toBe(1);
    expect(m.totalEventos).toBe(3);
    expect(m.totalNinas).toBe(2);
    expect(m.totalNinos).toBe(1);
    expect(m.promedioPorSesion).toBe(3);
    expect(m.picoSesion).toBe(3);
    expect(m.porEdad).toEqual([
      { edad: 8, cantidad: 1 },
      { edad: 9, cantidad: 1 },
      { edad: 10, cantidad: 1 },
    ]);
    expect(m.porNivel).toEqual([{ escuela: "Primaria", cantidad: 3 }]);
  });

  it("si hay agregado Y lista en la misma sesión, manda el agregado", async () => {
    // Caso real de 2026: dos sesiones traen el resumen del Excel y además
    // alguien pasó lista. El agregado incluye acompañantes y público no
    // inscrito; la lista solo ve a los niños inscritos.
    const m = await metricas([
      sesion({ resumen: agregado(31, 16, 15), lista: [nina(), nino(), nino()] }),
    ]);

    expect(m.sesionesCapturadas).toBe(1);
    expect(m.sesionesConAgregado).toBe(1);
    expect(m.sesionesConLista).toBe(0);
    expect(m.totalEventos).toBe(31);
    expect(m.totalNinas).toBe(16);
  });

  it("2026: 12 registradas, 7 capturadas, y los totales de siempre", async () => {
    // Reproducción de la edición real en la base local: doce fechas, siete con
    // resumen importado y cinco sin nada. Los números de asistencia tienen que
    // salir idénticos a los de antes del arreglo.
    const sesiones = [
      ...[31, 29, 27, 31, 22, 22, 15].map((t, i) =>
        sesion({ fecha: diaExcel(`2026-0${i + 1}-15`), resumen: agregado(t) }),
      ),
      ...Array.from({ length: 5 }, (_, i) =>
        sesion({ fecha: diaExcel(`2026-08-0${i + 1}`) }),
      ),
    ];
    const m = await metricas(sesiones);

    expect(m.totalSesiones).toBe(12);
    expect(m.sesionesCapturadas).toBe(7);
    expect(m.sesionesConAgregado).toBe(7);
    expect(m.sesionesConLista).toBe(0);
    expect(m.sesionesSinCapturar).toBe(5);
    // El promedio se divide entre las CAPTURADAS, no entre el total: dividir
    // entre doce lo que se contó en siete inventaría una caída que nadie midió.
    expect(m.totalEventos).toBe(177);
    expect(m.promedioPorSesion).toBe(25);
    expect(m.picoSesion).toBe(31);
    expect(m.porSesion).toHaveLength(7);
    expect(m.tendencia).toHaveLength(7);
  });
});

describe("obtenerAnalisisProfundo — misma definición de capturada", () => {
  beforeEach(() => vi.clearAllMocks());

  it("cuenta las capturadas de las dos fuentes sobre el total registrado", async () => {
    const { prisma } = await import("@/lib/prisma");
    vi.mocked(prisma.inscripcion.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.sesion.findMany).mockResolvedValue([
      sesion({ lista: [nina(), nino()] }),
      sesion({ resumen: agregado(31, 16, 15) }),
      sesion({ fecha: dia("2099-10-10") }),
    ] as never);

    const { obtenerAnalisisProfundo } = await import("@/server/queries/estadisticas");
    const a = await obtenerAnalisisProfundo("ed-1");

    expect(a.sesionesTotal).toBe(3);
    expect(a.sesionesCapturadas).toBe(2);
    // 2 de la lista + 31 del agregado, repartidos entre las dos capturadas.
    expect(a.promedioAsist).toBe(17);
  });
});

describe("obtenerEdicionPorId — misma definición de capturada", () => {
  beforeEach(() => vi.clearAllMocks());

  it("no decide nada mirando solo `resumen`: acepta las dos fuentes", async () => {
    const { prisma } = await import("@/lib/prisma");
    vi.mocked(prisma.edicion.findUnique).mockResolvedValue({
      id: "ed-1",
      anio: 2027,
      _count: { inscripciones: 3, clases: 2 },
    } as never);
    vi.mocked(prisma.sesion.count).mockResolvedValue(0 as never);

    const { obtenerEdicionPorId } = await import("@/server/queries/ediciones");
    const e = await obtenerEdicionPorId("ed-1");

    expect(e).not.toBeNull();
    const filtros = vi.mocked(prisma.sesion.count).mock.calls.map((c) => c[0]?.where);

    // Ningún conteo filtra por `resumen` a secas — ese era el defecto.
    expect(filtros.some((w) => w && "resumen" in w)).toBe(false);
    // Y ninguno filtra por fecha: una sesión cuenta desde que se crea.
    expect(filtros.some((w) => w && "fecha" in w)).toBe(false);

    const capturadas = filtros.find((w) => w && "OR" in w);
    expect(capturadas, "el conteo de capturadas debe aceptar ambas fuentes").toBeDefined();
    expect(capturadas!.OR).toEqual([
      { resumen: { isNot: null } },
      { asistencias: { some: { presente: true } } },
    ]);
  });
});
