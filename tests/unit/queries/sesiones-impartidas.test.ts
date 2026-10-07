import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// QUÉ CUENTA COMO «SESIÓN IMPARTIDA»
//
// Defecto reportado por QA: el dashboard decía «Sesiones impartidas 0/7» en una
// edición cuyas siete sesiones se habían creado en la aplicación y se les había
// pasado lista, y «7/12» en 2026. El número salía de contar únicamente las
// sesiones con `ResumenSesion` —los totales agregados que solo entran
// importando el Excel del organizador—, así que nada de lo que se hacía en la
// aplicación lo movía. QA lo resumió: «no sé qué activa las sesiones».
//
// Regla decidida por el coordinador del programa: una sesión está impartida si
// SU FECHA YA PASÓ. Ni resumen, ni lista, ni captura. El flujo real lo sostiene
// —«sábado se hacen las sesiones y domingo se cargan»—, así que toda sesión
// nace ya impartida.
//
// La captura no desaparece: se reporta aparte (`sesionesConDatos`,
// `sesionesSinCapturar`) y sigue alimentando los números de asistencia, ahora
// desde las DOS fuentes y no solo desde el Excel.
// ─────────────────────────────────────────────────────────────────────────────

vi.mock("@/lib/prisma", () => ({
  prisma: {
    sesion: { findMany: vi.fn(), count: vi.fn() },
    inscripcion: { findMany: vi.fn(), count: vi.fn() },
    clase: { findMany: vi.fn() },
    edicion: { findUnique: vi.fn() },
  },
}));

// Un sábado cualquiera a las 20:00 de Mérida = domingo 02:00 UTC. Es el momento
// peligroso: en UTC ya es el día siguiente. Las pruebas de frontera lo fijan.
const AHORA = new Date("2026-10-04T02:00:00Z"); // sábado 3 oct, 20:00 en Mérida

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

describe("obtenerMetricasAsistencia — sesiones impartidas (por fecha)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(AHORA);
  });
  afterEach(() => vi.useRealTimers());

  it("una sesión de AYER cuenta como impartida, aunque nadie haya capturado nada", async () => {
    const m = await metricas([sesion({ fecha: dia("2026-10-02") })]);

    expect(m.sesionesImpartidas).toBe(1);
    expect(m.totalSesiones).toBe(1);
    expect(m.sesionesConDatos).toBe(0);
    expect(m.sesionesSinCapturar).toBe(1);
  });

  it("una sesión de MAÑANA no cuenta, ni aunque ya tenga asistencia capturada", async () => {
    const m = await metricas([
      sesion({ fecha: dia("2026-10-04"), lista: [nina(), nino()] }),
    ]);

    expect(m.sesionesImpartidas).toBe(0);
    expect(m.sesionesSinCapturar).toBe(0);
    // Pero la asistencia capturada sí se contabiliza: son cosas distintas.
    expect(m.sesionesConDatos).toBe(1);
    expect(m.totalEventos).toBe(2);
  });

  it("una sesión de HOY todavía NO cuenta — «ya pasó» es estrictamente anterior", async () => {
    const m = await metricas([sesion({ fecha: dia("2026-10-03") })]);

    expect(m.sesionesImpartidas).toBe(0);
    expect(m.sesionesSinCapturar).toBe(0);
  });

  it("la frontera se mide en Mérida, no en UTC", async () => {
    // A las 20:00 del sábado 3 en Mérida ya son las 02:00 del domingo 4 en UTC.
    // Si la comparación se hiciera contra `new Date()` crudo, la sesión del
    // sábado 3 saldría como impartida seis horas antes de tiempo.
    const m = await metricas([
      sesion({ fecha: dia("2026-10-03"), nombre: "Hoy en Mérida, ayer en UTC" }),
      sesion({ fecha: dia("2026-10-02"), nombre: "Ayer de verdad" }),
    ]);

    expect(m.sesionesImpartidas).toBe(1);
  });

  it("da igual que la fecha venga a medianoche (app) o a mediodía (Excel)", async () => {
    const m = await metricas([
      sesion({ fecha: dia("2026-10-02") }),
      sesion({ fecha: diaExcel("2026-10-02") }),
      sesion({ fecha: dia("2026-10-03") }),
      sesion({ fecha: diaExcel("2026-10-03") }),
    ]);

    expect(m.sesionesImpartidas).toBe(2);
  });

  it("2026: las doce fechas ya pasaron, así que son 12/12 aunque solo 7 estén capturadas", async () => {
    // Reproducción de la edición real en la base local: doce fechas de
    // ene–jun 2026, siete con resumen importado y cinco sin nada.
    const sesiones = [
      ...[31, 29, 27, 31, 22, 22, 15].map((t, i) =>
        sesion({ fecha: diaExcel(`2026-0${i + 1}-15`), resumen: agregado(t) }),
      ),
      ...Array.from({ length: 5 }, (_, i) => sesion({ fecha: diaExcel(`2026-08-0${i + 1}`) })),
    ];
    const m = await metricas(sesiones);

    expect(m.sesionesImpartidas).toBe(12);
    expect(m.totalSesiones).toBe(12);
    expect(m.sesionesConDatos).toBe(7);
    expect(m.sesionesSinCapturar).toBe(5);
    // Y los números de asistencia salen EXACTAMENTE como antes del cambio: el
    // promedio se divide entre las capturadas, no entre las impartidas.
    expect(m.totalEventos).toBe(177);
    expect(m.promedioPorSesion).toBe(25);
    expect(m.picoSesion).toBe(31);
    expect(m.porSesion).toHaveLength(7);
    expect(m.tendencia).toHaveLength(7);
  });

  it("sin ninguna sesión, todo en cero y sin dividir entre cero", async () => {
    const m = await metricas([]);

    expect(m.sesionesImpartidas).toBe(0);
    expect(m.totalSesiones).toBe(0);
    expect(m.sesionesConDatos).toBe(0);
    expect(m.sesionesSinCapturar).toBe(0);
    expect(m.promedioPorSesion).toBe(0);
    expect(m.picoSesion).toBe(0);
  });
});

// ── La captura, que ya no decide si algo se impartió pero sí mueve el panel ──

describe("obtenerMetricasAsistencia — asistencia capturada, de las dos fuentes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(AHORA);
  });
  afterEach(() => vi.useRealTimers());

  it("la lista pasada en la aplicación alimenta el panel, no solo el Excel", async () => {
    const m = await metricas([
      sesion({ fecha: dia("2026-10-02"), lista: [nina(), nina(8), nino()] }),
    ]);

    expect(m.sesionesConDatos).toBe(1);
    expect(m.sesionesConLista).toBe(1);
    expect(m.sesionesConAgregado).toBe(0);
    expect(m.totalEventos).toBe(3);
    expect(m.totalNinas).toBe(2);
    expect(m.totalNinos).toBe(1);
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
      sesion({
        fecha: dia("2026-10-02"),
        resumen: agregado(31, 16, 15),
        lista: [nina(), nino(), nino()],
      }),
    ]);

    expect(m.sesionesConDatos).toBe(1);
    expect(m.sesionesConAgregado).toBe(1);
    expect(m.sesionesConLista).toBe(0);
    expect(m.totalEventos).toBe(31);
    expect(m.totalNinas).toBe(16);
  });
});

describe("obtenerAnalisisProfundo — misma definición de impartida", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(AHORA);
  });
  afterEach(() => vi.useRealTimers());

  it("cuenta las impartidas por fecha y la captura de las dos fuentes", async () => {
    const { prisma } = await import("@/lib/prisma");
    vi.mocked(prisma.inscripcion.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.sesion.findMany).mockResolvedValue([
      sesion({ fecha: dia("2026-10-01"), lista: [nina(), nino()] }),
      sesion({ fecha: dia("2026-10-02"), resumen: agregado(31, 16, 15) }),
      sesion({ fecha: dia("2026-10-10") }),
    ] as never);

    const { obtenerAnalisisProfundo } = await import("@/server/queries/estadisticas");
    const a = await obtenerAnalisisProfundo("ed-1");

    expect(a.sesionesImpartidas).toBe(2);
    expect(a.sesionesConDatos).toBe(2);
    expect(a.sesionesTotal).toBe(3);
    // 2 de la lista + 31 del agregado, repartidos entre las dos capturadas.
    expect(a.promedioAsist).toBe(17);
  });
});

describe("obtenerEdicionPorId — misma definición de impartida", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(AHORA);
  });
  afterEach(() => vi.useRealTimers());

  it("cuenta por fecha, no por resumen del Excel", async () => {
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
    const impartidas = filtros.find((w) => w && "fecha" in w);
    expect(impartidas, "el conteo de impartidas debe filtrar por fecha").toBeDefined();
    // Medianoche UTC del día de HOY en Mérida: el sábado 3, no el domingo 4.
    expect(impartidas!.fecha).toEqual({ lt: new Date("2026-10-03T00:00:00.000Z") });
    expect(filtros.some((w) => w && "resumen" in w)).toBe(false);
  });
});
