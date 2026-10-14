import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// LAS ESTADÍSTICAS SOLO CUENTAN SESIONES DE PASAPORTE — contra base REAL.
//
// El defecto que reportó el coordinador (octubre de 2026): la tarjeta
// «Asistencia capturada» del tablero decía «12/22 · faltan 10 por capturar» en
// una edición con 12 sesiones de pasaporte, 8 de lectura y 2 eventos. Las 10
// que «faltaban» eran justo los extras, que a él no le interesan: ensuciaban la
// cifra y le inventaban trabajo pendiente que no existe.
//
// La decisión fue cambiar QUÉ SE CUENTA, no qué se puede capturar: se sigue
// pasando lista en lectura y en eventos —ese dato no se pierde— pero queda
// fuera de las estadísticas. La lista de tipos que cuentan vive en un solo
// sitio, `src/lib/tipos-sesion.ts`.
//
// Esta prueba siembra exactamente esa edición (12 + 8 + 2) y comprueba que el
// contador diga 12/12.
//
// No se ejecuta por defecto: necesita `PRUEBAS_DB=1` y una base desechable.
// Además se niega a correr si DATABASE_URL no apunta a localhost.
//
//   PRUEBAS_DB=1 \
//   DATABASE_URL="postgresql://postgres:qa_local_pw@localhost:55445/pasaporte" \
//   DIRECT_URL="postgresql://postgres:qa_local_pw@localhost:55445/pasaporte" \
//   npx vitest run tests/integration/db/estadisticas-solo-pasaporte.test.ts
// ─────────────────────────────────────────────────────────────────────────────

const url = process.env.DATABASE_URL ?? "";
const esLocal = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
const habilitado = process.env.PRUEBAS_DB === "1" && esLocal;

if (process.env.PRUEBAS_DB === "1" && !esLocal) {
  throw new Error(
    "PRUEBAS_DB=1 pero DATABASE_URL no es local: estas pruebas escriben y borran datos.",
  );
}

// Año propio: vitest corre los archivos en serie pero `Edicion.anio` es único y
// cada prueba contra base real siembra el suyo (2090-2097 ya están tomados).
const ANIO = 2098;
const MARCA = "QA-SOLO-PASAPORTE";

let prisma: import("@prisma/client").PrismaClient;
let edicionId = "";

async function limpiar() {
  const ediciones = await prisma.edicion.findMany({
    where: { anio: ANIO },
    select: { id: true },
  });
  const ids = ediciones.map((e) => e.id);
  if (ids.length === 0) {
    await prisma.participante.deleteMany({ where: { ciudad: MARCA } });
    return;
  }

  await prisma.asistencia.deleteMany({
    where: { inscripcion: { edicionId: { in: ids } } },
  });
  await prisma.resumenSesion.deleteMany({
    where: { sesion: { clase: { edicionId: { in: ids } } } },
  });
  await prisma.sesion.deleteMany({ where: { clase: { edicionId: { in: ids } } } });
  await prisma.clase.deleteMany({ where: { edicionId: { in: ids } } });
  await prisma.inscripcion.deleteMany({ where: { edicionId: { in: ids } } });
  await prisma.edicion.deleteMany({ where: { id: { in: ids } } });
  await prisma.participante.deleteMany({ where: { ciudad: MARCA } });
}

async function inscribirNino(sufijo: string, genero: "FEMENINO" | "MASCULINO") {
  const participante = await prisma.participante.create({
    data: {
      nombre: `Niñe${sufijo}`,
      apellidos: `De${ANIO}`,
      edad: genero === "FEMENINO" ? 9 : 10,
      genero,
      nivel: "PRIMARIA",
      escuela: "Primaria de prueba",
      grado: "4° Primaria",
      ciudad: MARCA,
    },
  });
  return prisma.inscripcion.create({
    data: { participanteId: participante.id, edicionId },
  });
}

/** Crea una actividad con su fecha y devuelve el id de esa fecha (`Sesion`). */
async function crearActividad(opts: {
  nombre: string;
  tipo: "PASAPORTE" | "LECTURA" | "EVENTO";
  dia: string;
}) {
  const clase = await prisma.clase.create({
    data: {
      edicionId,
      nombre: opts.nombre,
      tipo: opts.tipo,
      investigador: opts.tipo === "EVENTO" ? null : "Dra. Ejemplo",
    },
  });
  const sesion = await prisma.sesion.create({
    data: { claseId: clase.id, fecha: new Date(`${ANIO}-${opts.dia}T00:00:00.000Z`) },
  });
  return { claseId: clase.id, sesionId: sesion.id };
}

/** Día del mes de la i-ésima actividad, repartidas por el calendario. */
const dia = (i: number) => `${String(Math.floor(i / 28) + 1).padStart(2, "0")}-${String((i % 28) + 1).padStart(2, "0")}`;

describe.skipIf(!habilitado)("estadísticas: solo cuentan las sesiones de pasaporte", () => {
  // La edición del coordinador, tal cual: 12 charlas, 8 lecturas, 2 eventos.
  let pasaporte: { claseId: string; sesionId: string }[] = [];
  let lectura: { claseId: string; sesionId: string }[] = [];
  let eventos: { claseId: string; sesionId: string }[] = [];
  let ninaId = "";

  beforeAll(async () => {
    const { PrismaClient } = await import("@prisma/client");
    prisma = new PrismaClient();
    await limpiar();
  }, 60_000);

  beforeEach(async () => {
    await limpiar();
    const edicion = await prisma.edicion.create({
      data: {
        anio: ANIO,
        nombre: `Edición ${ANIO}`,
        fechaInicio: new Date(`${ANIO}-01-10T00:00:00.000Z`),
        fechaFin: new Date(`${ANIO}-11-30T00:00:00.000Z`),
        minAsistencias: 6,
        activa: false,
      },
    });
    edicionId = edicion.id;

    pasaporte = [];
    for (let i = 0; i < 12; i++) {
      pasaporte.push(
        await crearActividad({ nombre: `Charla ${i + 1}`, tipo: "PASAPORTE", dia: dia(i) }),
      );
    }
    lectura = [];
    for (let i = 0; i < 8; i++) {
      lectura.push(
        await crearActividad({ nombre: `Lectura ${i + 1}`, tipo: "LECTURA", dia: dia(i + 100) }),
      );
    }
    eventos = [];
    for (const [i, nombre] of ["Día del niño", "Clausura"].entries()) {
      eventos.push(await crearActividad({ nombre, tipo: "EVENTO", dia: dia(i + 200) }));
    }

    // Una niña y un niño inscritos, y la lista pasada en las 12 charlas: así
    // las 12 de pasaporte quedan capturadas y los extras no. Es la foto exacta
    // de la captura de producción que dio el 12/22.
    const nina = await inscribirNino("Ana", "FEMENINO");
    const nino = await inscribirNino("Beto", "MASCULINO");
    ninaId = nina.id;
    await prisma.asistencia.createMany({
      data: pasaporte.flatMap((p) => [
        { inscripcionId: nina.id, sesionId: p.sesionId, presente: true },
        { inscripcionId: nino.id, sesionId: p.sesionId, presente: true },
      ]),
    });
  }, 60_000);

  afterAll(async () => {
    if (!prisma) return;
    await limpiar();
    await prisma.$disconnect();
  });

  // ── El contador que pidió el coordinador ────────────────────────────────────

  it("el contador de asistencia capturada dice 12/12, no 12/22", async () => {
    const { obtenerMetricasAsistencia } = await import("@/server/queries/estadisticas");
    const m = await obtenerMetricasAsistencia(edicionId);

    expect(m.totalSesiones).toBe(12);
    expect(m.sesionesCapturadas).toBe(12);
    expect(m.sesionesSinCapturar).toBe(0);
  });

  it("la ficha de la edición cuenta lo mismo que el tablero", async () => {
    const { obtenerEdicionPorId } = await import("@/server/queries/ediciones");
    const e = await obtenerEdicionPorId(edicionId);

    expect(e?.sesionesTotal).toBe(12);
    expect(e?.sesionesCapturadas).toBe(12);
  });

  it("el análisis profundo cuenta lo mismo que el tablero", async () => {
    const { obtenerAnalisisProfundo } = await import("@/server/queries/estadisticas");
    const a = await obtenerAnalisisProfundo(edicionId);

    expect(a.sesionesTotal).toBe(12);
    expect(a.sesionesCapturadas).toBe(12);
  });

  // ── Capturar lectura y eventos sigue siendo posible, pero no mueve nada ──────

  it("pasar lista en una lectura no mueve el contador ni el promedio ni el pico", async () => {
    const { obtenerMetricasAsistencia } = await import("@/server/queries/estadisticas");
    const antes = await obtenerMetricasAsistencia(edicionId);

    // El coordinador dijo expresamente que la lectura se sigue pudiendo
    // capturar: lo que cambia es qué se cuenta, no qué se puede registrar.
    await prisma.asistencia.create({
      data: { inscripcionId: ninaId, sesionId: lectura[0].sesionId, presente: true },
    });
    // Y por si alguien importa el Excel de un evento, el agregado tampoco entra.
    await prisma.resumenSesion.create({
      data: { sesionId: eventos[0].sesionId, ninas: 40, ninos: 40, total: 80, mamas: 10, papas: 5 },
    });

    const despues = await obtenerMetricasAsistencia(edicionId);

    expect(despues.totalSesiones).toBe(12);
    expect(despues.sesionesCapturadas).toBe(12);
    expect(despues.sesionesSinCapturar).toBe(0);
    expect(despues.promedioPorSesion).toBe(antes.promedioPorSesion);
    expect(despues.picoSesion).toBe(antes.picoSesion);
    expect(despues.totalEventos).toBe(antes.totalEventos);
    expect(despues.totalNinas).toBe(antes.totalNinas);
    expect(despues.totalNinos).toBe(antes.totalNinos);
    expect(despues.totalMamas).toBe(antes.totalMamas);
    expect(despues.totalPapas).toBe(antes.totalPapas);
    expect(despues.tendencia).toEqual(antes.tendencia);
    expect(despues.porEdad).toEqual(antes.porEdad);
    expect(despues.porNivel).toEqual(antes.porNivel);
    expect(despues.porGenero).toEqual(antes.porGenero);
  });

  it("el dato de lectura y eventos NO se pierde: sigue en la base", async () => {
    await prisma.asistencia.create({
      data: { inscripcionId: ninaId, sesionId: lectura[0].sesionId, presente: true },
    });
    await prisma.asistencia.create({
      data: { inscripcionId: ninaId, sesionId: eventos[0].sesionId, presente: true },
    });

    const enExtras = await prisma.asistencia.count({
      where: {
        inscripcion: { edicionId },
        sesion: { clase: { tipo: { in: ["LECTURA", "EVENTO"] } } },
      },
    });
    expect(enExtras).toBe(2);
  });

  // ── El inventario sí enseña los tres tipos ──────────────────────────────────

  it("el desglose por tipo sigue mostrando los tres, con sus asistencias", async () => {
    await prisma.asistencia.create({
      data: { inscripcionId: ninaId, sesionId: lectura[0].sesionId, presente: true },
    });

    const { obtenerMetricasEdicion } = await import("@/server/queries/estadisticas");
    const m = await obtenerMetricasEdicion(edicionId);

    // `porTipo` es inventario, no estadística: existe justo para enseñar
    // cuántas sesiones y asistencias hay de cada tipo. Filtrarlo lo vaciaría
    // de sentido.
    expect(m.porTipo).toEqual([
      { tipo: "PASAPORTE", sesiones: 12, asistencias: 24 },
      { tipo: "LECTURA", sesiones: 8, asistencias: 1 },
      { tipo: "EVENTO", sesiones: 2, asistencias: 0 },
    ]);
    expect(m.totalSesiones).toBe(12);
  });

  it("las métricas de la edición no cuentan los extras", async () => {
    const { obtenerMetricasEdicion } = await import("@/server/queries/estadisticas");
    const m = await obtenerMetricasEdicion(edicionId);

    // 12 charlas, 2 niños, asistieron a todas: 100%. Con los 10 extras en el
    // denominador salía 55%, una caída inventada.
    expect(m.totalSesiones).toBe(12);
    expect(m.promedioAsistencia).toBe(100);
    expect(m.clasesResumen).toHaveLength(12);
    expect(m.rankingClases).toHaveLength(12);
    expect(m.tendencia).toHaveLength(12);
  });
});
