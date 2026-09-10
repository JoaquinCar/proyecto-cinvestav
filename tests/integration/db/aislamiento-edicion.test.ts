import { describe, it, expect, beforeAll, afterAll } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// Aislamiento entre ediciones contra una base de datos REAL.
//
// Es la prueba central del arreglo multi-edición: el reporte de la edición A no
// debe mostrar ni un solo dato de la edición B.
//
// No se ejecuta por defecto: necesita `PRUEBAS_DB=1` y una base desechable.
// Además se niega a correr si DATABASE_URL no apunta a localhost, para que
// nunca toque producción por accidente.
//
//   PRUEBAS_DB=1 \
//   DATABASE_URL="postgresql://postgres:qa_local_pw@localhost:55445/pasaporte" \
//   DIRECT_URL="postgresql://postgres:qa_local_pw@localhost:55445/pasaporte" \
//   npx vitest run tests/integration/db
// ─────────────────────────────────────────────────────────────────────────────

const url = process.env.DATABASE_URL ?? "";
const esLocal = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
const habilitado = process.env.PRUEBAS_DB === "1" && esLocal;

if (process.env.PRUEBAS_DB === "1" && !esLocal) {
  throw new Error(
    "PRUEBAS_DB=1 pero DATABASE_URL no es local: estas pruebas escriben y borran datos.",
  );
}

const ANIO_A = 2091;
const ANIO_B = 2092;
const MARCA = "QA-AISLAMIENTO";

let prisma: import("@prisma/client").PrismaClient;
let edicionA = "";
let edicionB = "";

async function limpiar() {
  const ediciones = await prisma.edicion.findMany({
    where: { anio: { in: [ANIO_A, ANIO_B] } },
    select: { id: true },
  });
  const ids = ediciones.map((e) => e.id);
  if (ids.length === 0) return;

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

/**
 * Siembra una edición completa y devuelve su id.
 * A y B se construyen con volúmenes y escuelas distintas a propósito: si el
 * reporte se equivoca de edición, los números no cuadran de ninguna manera.
 */
async function sembrarEdicion(opts: {
  anio: number;
  nombre: string;
  escuela: string;
  ninas: number;
  ninos: number;
  totalPorSesion: number;
  activa: boolean;
}) {
  const edicion = await prisma.edicion.create({
    data: {
      anio: opts.anio,
      nombre: opts.nombre,
      fechaInicio: new Date(`${opts.anio}-02-01T00:00:00.000Z`),
      fechaFin: new Date(`${opts.anio}-06-30T00:00:00.000Z`),
      minAsistencias: 4,
      activa: opts.activa,
    },
  });

  const clase = await prisma.clase.create({
    data: {
      edicionId: edicion.id,
      nombre: `Clase ${opts.anio}`,
      investigador: `Dra. ${opts.anio}`,
    },
  });

  const sesion = await prisma.sesion.create({
    data: {
      claseId: clase.id,
      fecha: new Date(`${opts.anio}-03-01T00:00:00.000Z`),
      temas: `Tema ${opts.anio}`,
    },
  });

  await prisma.resumenSesion.create({
    data: {
      sesionId: sesion.id,
      ninas: opts.ninas,
      ninos: opts.ninos,
      total: opts.totalPorSesion,
      mamas: 1,
      papas: 1,
    },
  });

  const total = opts.ninas + opts.ninos;
  for (let i = 0; i < total; i++) {
    const participante = await prisma.participante.create({
      data: {
        nombre: `Niñe${i}`,
        apellidos: `De${opts.anio}`,
        edad: 8 + (i % 3),
        escuela: opts.escuela,
        grado: "3° Primaria",
        genero: i < opts.ninas ? "FEMENINO" : "MASCULINO",
        nivel: "PRIMARIA",
        ciudad: MARCA,
        telefono: `55500${opts.anio}${i}`,
      },
    });
    const inscripcion = await prisma.inscripcion.create({
      data: { participanteId: participante.id, edicionId: edicion.id },
    });
    await prisma.asistencia.create({
      data: { inscripcionId: inscripcion.id, sesionId: sesion.id, presente: true },
    });
  }

  return edicion.id;
}

describe.skipIf(!habilitado)("reporte por edición contra la base real", () => {
  beforeAll(async () => {
    const { PrismaClient } = await import("@prisma/client");
    prisma = new PrismaClient();
    await limpiar();
    // A: 5 niñas + 2 niños, escuela propia. B: 3 niñas + 6 niños, otra escuela.
    edicionA = await sembrarEdicion({
      anio: ANIO_A,
      nombre: `Edición ${ANIO_A}`,
      escuela: "Primaria Alfa",
      ninas: 5,
      ninos: 2,
      totalPorSesion: 7,
      activa: false,
    });
    edicionB = await sembrarEdicion({
      anio: ANIO_B,
      nombre: `Edición ${ANIO_B}`,
      escuela: "Primaria Beta",
      ninas: 3,
      ninos: 6,
      totalPorSesion: 9,
      activa: true, // B es la activa: A solo se alcanza pidiéndola explícitamente
    });
  }, 60_000);

  afterAll(async () => {
    if (!prisma) return;
    await limpiar();
    await prisma.$disconnect();
  });

  it("obtenerAnalisisProfundo(A) no mezcla datos de B", async () => {
    const { obtenerAnalisisProfundo } = await import(
      "@/server/queries/estadisticas"
    );

    const a = await obtenerAnalisisProfundo(edicionA);
    const b = await obtenerAnalisisProfundo(edicionB);

    expect(a.totalNinos).toBe(7);
    expect(a.totalNinas).toBe(5);
    expect(b.totalNinos).toBe(9);
    expect(b.totalNinas).toBe(3);

    // Las escuelas de una edición no aparecen en la otra.
    const escuelasA = a.concentracionEscuelas.map((e) => e.escuela);
    const escuelasB = b.concentracionEscuelas.map((e) => e.escuela);
    expect(escuelasA).toEqual(["Primaria Alfa"]);
    expect(escuelasB).toEqual(["Primaria Beta"]);

    // Ni los contactos.
    expect(
      a.registrosPorContacto.some((c) => c.contacto.includes(String(ANIO_B))),
    ).toBe(false);

    expect(a.promedioAsist).toBe(7);
    expect(b.promedioAsist).toBe(9);
  });

  it("obtenerMetricasEdicion / obtenerMetricasAsistencia respetan la edición pedida", async () => {
    const { obtenerMetricasEdicion, obtenerMetricasAsistencia } = await import(
      "@/server/queries/estadisticas"
    );

    const mA = await obtenerMetricasEdicion(edicionA);
    const mB = await obtenerMetricasEdicion(edicionB);
    expect(mA.totalParticipantes).toBe(7);
    expect(mB.totalParticipantes).toBe(9);
    expect(mA.porEscuela.map((e) => e.escuela)).toEqual(["Primaria Alfa"]);

    const asA = await obtenerMetricasAsistencia(edicionA);
    const asB = await obtenerMetricasAsistencia(edicionB);
    expect(asA.totalEventos).toBe(7);
    expect(asB.totalEventos).toBe(9);
  });

  it("obtenerEdicionPorId(A) devuelve A aunque la activa sea B", async () => {
    // El cableado edicionId → panel de análisis se comprueba en la prueba
    // unitaria de la página (importarla aquí arrastraría next-auth).
    const { obtenerEdicionPorId } = await import("@/server/queries/ediciones");
    const edicion = await obtenerEdicionPorId(edicionA);
    expect(edicion?.anio).toBe(ANIO_A);
    expect(edicion?.activa).toBe(false);
  });

  it("una edición cerrada rechaza nuevas asistencias", async () => {
    const { batchUpsertAsistencias } = await import(
      "@/server/queries/asistencias"
    );
    const { EdicionCerradaError } = await import(
      "@/server/queries/edicion-cerrada"
    );

    const inscripcion = await prisma.inscripcion.findFirst({
      where: { edicionId: edicionA },
      select: { id: true },
    });
    const sesion = await prisma.sesion.findFirst({
      where: { clase: { edicionId: edicionA } },
      select: { id: true },
    });

    await prisma.edicion.update({
      where: { id: edicionA },
      data: { cerrada: true },
    });

    await expect(
      batchUpsertAsistencias([
        { inscripcionId: inscripcion!.id, sesionId: sesion!.id, presente: false },
      ]),
    ).rejects.toBeInstanceOf(EdicionCerradaError);

    // Reabrir y comprobar que vuelve a escribir.
    await prisma.edicion.update({
      where: { id: edicionA },
      data: { cerrada: false },
    });
    await expect(
      batchUpsertAsistencias([
        { inscripcionId: inscripcion!.id, sesionId: sesion!.id, presente: false },
      ]),
    ).resolves.toHaveLength(1);
  });
});
