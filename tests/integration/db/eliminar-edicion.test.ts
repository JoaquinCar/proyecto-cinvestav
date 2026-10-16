import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// Borrar una edición, contra una base de datos REAL.
//
// El guardia solo miraba las inscripciones, pero de una edición también cuelgan
// sus SESIONES, y esa llave foránea no cascadea. Una edición de prueba con
// sesiones y ningún niño inscrito pasaba el guardia y reventaba después en
// Prisma; la ruta lo devolvía como «Error interno del servidor» y el
// coordinador no podía borrarla ni saber por qué. Es justo lo que le pasó con
// la edición 2027: 0 inscripciones, 3 sesiones.
//
// Un mock no demuestra lo que aquí importa: que la llave foránea de verdad deja
// pasar el borrado y que no queda nada suelto detrás.
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

const ANIO = 2093;
const MARCA = "QA-BORRAR-EDICION";

let prisma: import("@prisma/client").PrismaClient;

/** Borra solo lo sembrado por esta prueba. */
async function limpiar() {
  const ediciones = await prisma.edicion.findMany({
    where:  { anio: ANIO },
    select: { id: true },
  });
  for (const { id } of ediciones) {
    await prisma.asistencia.deleteMany({ where: { inscripcion: { edicionId: id } } });
    await prisma.sesion.deleteMany({ where: { clase: { edicionId: id } } });
    await prisma.clase.deleteMany({ where: { edicionId: id } });
    await prisma.inscripcion.deleteMany({ where: { edicionId: id } });
    await prisma.edicion.delete({ where: { id } });
  }
  await prisma.participante.deleteMany({ where: { escuela: MARCA } });
}

/** Una edición con `sesiones` sesiones y `ninos` niños inscritos. */
async function sembrar({ sesiones = 0, ninos = 0, conLista = false }) {
  const edicion = await prisma.edicion.create({
    data: {
      anio:        ANIO,
      nombre:      `Edición de prueba ${ANIO}`,
      fechaInicio: new Date(Date.UTC(ANIO, 0, 10)),
      fechaFin:    new Date(Date.UTC(ANIO, 5, 30)),
    },
  });

  const fechas: string[] = [];
  for (let i = 0; i < sesiones; i++) {
    const clase = await prisma.clase.create({
      data: { nombre: `Sesión ${i + 1}`, edicionId: edicion.id, tipo: "PASAPORTE" },
    });
    const sesion = await prisma.sesion.create({
      data: { claseId: clase.id, fecha: new Date(Date.UTC(ANIO, 0, 17 + i)) },
    });
    fechas.push(sesion.id);
  }

  const inscripciones: string[] = [];
  for (let i = 0; i < ninos; i++) {
    const p = await prisma.participante.create({
      data: {
        nombre:    `Niño ${i + 1}`,
        apellidos: "De Prueba",
        escuela:   MARCA,
        edad:      10,
        grado:     "4° primaria",
      },
    });
    const insc = await prisma.inscripcion.create({
      data: { participanteId: p.id, edicionId: edicion.id },
    });
    inscripciones.push(insc.id);
    if (conLista && fechas[0]) {
      await prisma.asistencia.create({
        data: { inscripcionId: insc.id, sesionId: fechas[0], presente: true },
      });
    }
  }

  return { edicionId: edicion.id };
}

/** Qué queda colgando de una edición que ya debería no existir. */
async function huerfanos(edicionId: string) {
  const [ediciones, clases, sesiones, inscripciones, asistencias] = await Promise.all([
    prisma.edicion.count({ where: { id: edicionId } }),
    prisma.clase.count({ where: { edicionId } }),
    prisma.sesion.count({ where: { clase: { edicionId } } }),
    prisma.inscripcion.count({ where: { edicionId } }),
    prisma.asistencia.count({ where: { inscripcion: { edicionId } } }),
  ]);
  return { ediciones, clases, sesiones, inscripciones, asistencias };
}

describe.skipIf(!habilitado)("borrar una edición", () => {
  beforeAll(async () => {
    const { PrismaClient } = await import("@prisma/client");
    prisma = new PrismaClient();
    await limpiar();
  });

  afterAll(async () => {
    await limpiar();
    await prisma.$disconnect();
  });

  beforeEach(limpiar);

  it("una edición con sesiones y SIN niños se borra (el caso de 2027)", async () => {
    const { edicionId } = await sembrar({ sesiones: 3 });
    const { eliminarEdicion } = await import("@/server/queries/ediciones");

    await eliminarEdicion(edicionId);

    expect(await huerfanos(edicionId)).toEqual({
      ediciones: 0,
      clases: 0,
      sesiones: 0,
      inscripciones: 0,
      asistencias: 0,
    });
  });

  it("una edición vacía del todo también", async () => {
    const { edicionId } = await sembrar({});
    const { eliminarEdicion } = await import("@/server/queries/ediciones");

    await eliminarEdicion(edicionId);
    expect(await prisma.edicion.count({ where: { id: edicionId } })).toBe(0);
  });

  it("con niños inscritos se niega, y no toca nada", async () => {
    const { edicionId } = await sembrar({ sesiones: 2, ninos: 3, conLista: true });
    const { eliminarEdicion, EdicionConInscripcionesError } = await import(
      "@/server/queries/ediciones"
    );

    const error = await eliminarEdicion(edicionId).catch((e) => e);
    expect(error).toBeInstanceOf(EdicionConInscripcionesError);
    // El mensaje dice cuántos NIÑOS, no solo cuántas filas.
    expect(error.message).toMatch(/3 niño/);
    expect(error.conteos.participantes).toBe(3);

    // Y dice qué hacer ahora: volver a pulsar. La primera versión ofrecía
    // además «cancela y dalos de baja uno a uno», y el coordinador se pasó un
    // rato sacando niños a mano para poder borrar una edición de prueba.
    expect(error.message).toMatch(/vuelve a pulsar/i);
    expect(error.message).not.toMatch(/uno a uno|da de baja|dalos de baja/i);

    // Y sobre todo: no se borró nada.
    expect(await huerfanos(edicionId)).toEqual({
      ediciones: 1,
      clases: 2,
      sesiones: 2,
      inscripciones: 3,
      asistencias: 3,
    });
  });

  it("forzando se borra todo, y los niños sobreviven como fichas", async () => {
    const { edicionId } = await sembrar({ sesiones: 2, ninos: 3, conLista: true });
    const { eliminarEdicion } = await import("@/server/queries/ediciones");

    await eliminarEdicion(edicionId, { forzar: true });

    expect(await huerfanos(edicionId)).toEqual({
      ediciones: 0,
      clases: 0,
      sesiones: 0,
      inscripciones: 0,
      asistencias: 0,
    });
    // La ficha del niño es global: vuelve el año que viene.
    expect(await prisma.participante.count({ where: { escuela: MARCA } })).toBe(3);
  });

  it("una edición que ya no existe se dice con nombre propio", async () => {
    const { eliminarEdicion, EdicionNoEncontradaError } = await import(
      "@/server/queries/ediciones"
    );

    const error = await eliminarEdicion("edicion-que-no-existe").catch((e) => e);
    expect(error).toBeInstanceOf(EdicionNoEncontradaError);
    expect(error.message).toMatch(/ya no existe/i);
  });
});
