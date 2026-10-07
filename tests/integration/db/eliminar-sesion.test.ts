import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// Borrar una sesión (el modelo `Clase`), contra una base de datos REAL.
//
// Un mock no puede demostrar lo que aquí importa: que después del borrado no
// queda NADA suelto —ni la fecha, ni las imágenes, ni el resumen importado— y
// que lo que no se pidió borrar sigue en su sitio (el niño, su inscripción, la
// ficha del staff).
//
// No se ejecuta por defecto: necesita `PRUEBAS_DB=1` y una base desechable.
// Además se niega a correr si DATABASE_URL no apunta a localhost.
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

const ANIO = 2094;
/** Marca propia para no rozar datos de otras pruebas ni de nadie más. */
const MARCA = "QA-BORRAR-SESION";

let prisma: import("@prisma/client").PrismaClient;
let edicionId = "";

/** Borra solo lo sembrado por esta prueba (edición del año ficticio). */
async function limpiar() {
  const ediciones = await prisma.edicion.findMany({
    where: { anio: ANIO },
    select: { id: true },
  });
  const ids = ediciones.map((e) => e.id);

  if (ids.length > 0) {
    await prisma.asistencia.deleteMany({
      where: { sesion: { clase: { edicionId: { in: ids } } } },
    });
    await prisma.resumenSesion.deleteMany({
      where: { sesion: { clase: { edicionId: { in: ids } } } },
    });
    await prisma.sesion.deleteMany({ where: { clase: { edicionId: { in: ids } } } });
    await prisma.staffClase.deleteMany({ where: { clase: { edicionId: { in: ids } } } });
    await prisma.imagenClase.deleteMany({ where: { clase: { edicionId: { in: ids } } } });
    await prisma.clase.deleteMany({ where: { edicionId: { in: ids } } });
    await prisma.inscripcion.deleteMany({ where: { edicionId: { in: ids } } });
    await prisma.edicion.deleteMany({ where: { id: { in: ids } } });
  }

  await prisma.participante.deleteMany({ where: { apellidos: MARCA } });
  await prisma.staff.deleteMany({ where: { apellidos: MARCA } });
}

/** Una sesión con su fecha, una imagen y una persona de staff asignada. */
async function sembrarSesion(nombre: string) {
  const { crearClaseConSesion } = await import("@/server/queries/clases");

  const clase = await crearClaseConSesion({
    edicionId,
    nombre,
    investigador: "Dra. Ejemplo",
    fecha: new Date(`${ANIO}-03-14T00:00:00.000Z`),
  });

  const imagen = await prisma.imagenClase.create({
    data: {
      claseId:  clase.id,
      url:      "data:image/png;base64,iVBORw0KGgo=",
      mimeType: "image/png",
      orden:    0,
    },
  });

  const staff = await prisma.staff.create({
    data: { nombre: "Becario", apellidos: MARCA, rol: "BECARIO" },
  });
  await prisma.staffClase.create({
    data: { staffId: staff.id, claseId: clase.id },
  });

  return { claseId: clase.id, sesionId: clase.sesionId, imagenId: imagen.id, staffId: staff.id };
}

/** Un niño inscrito con asistencia confirmada en esa fecha. */
async function sembrarListaPasada(sesionId: string) {
  const participante = await prisma.participante.create({
    data: {
      nombre:    "Niño",
      apellidos: MARCA,
      edad:      9,
      escuela:   "Primaria de prueba",
      grado:     "4°",
    },
  });

  const inscripcion = await prisma.inscripcion.create({
    data: { participanteId: participante.id, edicionId },
  });

  await prisma.asistencia.create({
    data: { inscripcionId: inscripcion.id, sesionId, presente: true },
  });

  return { participanteId: participante.id, inscripcionId: inscripcion.id };
}

describe.skipIf(!habilitado)("borrar una sesión no deja nada suelto", () => {
  beforeAll(async () => {
    const { PrismaClient } = await import("@prisma/client");
    prisma = new PrismaClient();
    await limpiar();
  }, 60_000);

  beforeEach(async () => {
    await limpiar();
    const edicion = await prisma.edicion.create({
      data: {
        anio:        ANIO,
        nombre:      `Edición ${ANIO}`,
        fechaInicio: new Date(`${ANIO}-02-01T00:00:00.000Z`),
        fechaFin:    new Date(`${ANIO}-06-30T00:00:00.000Z`),
        minAsistencias: 4,
        activa:      false,
      },
    });
    edicionId = edicion.id;
  });

  afterAll(async () => {
    if (!prisma) return;
    await limpiar();
    await prisma.$disconnect();
  });

  // ── El caso que reportó QA ────────────────────────────────────────────────

  it("una sesión creada por error se borra con su fecha, imágenes y staff asignado", async () => {
    const { eliminarClase } = await import("@/server/queries/clases");
    const sembrada = await sembrarSesion("Sesión de prueba 2027");

    await eliminarClase(sembrada.claseId);

    expect(await prisma.clase.count({ where: { id: sembrada.claseId } })).toBe(0);
    expect(await prisma.sesion.count({ where: { claseId: sembrada.claseId } })).toBe(0);
    expect(await prisma.imagenClase.count({ where: { claseId: sembrada.claseId } })).toBe(0);
    expect(await prisma.staffClase.count({ where: { claseId: sembrada.claseId } })).toBe(0);

    // La persona de staff NO se borra: sigue en otras sesiones y en otros años.
    expect(await prisma.staff.count({ where: { id: sembrada.staffId } })).toBe(1);
  });

  // ── Lo que sí se protege ──────────────────────────────────────────────────

  it("con lista pasada se niega y no toca nada", async () => {
    const { eliminarClase, ClaseConAsistenciasError } = await import(
      "@/server/queries/clases"
    );
    const sembrada = await sembrarSesion("Robótica");
    await sembrarListaPasada(sembrada.sesionId);

    const error = await eliminarClase(sembrada.claseId).catch((e) => e);
    expect(error).toBeInstanceOf(ClaseConAsistenciasError);
    expect(error.conteos.asistencias).toBe(1);
    expect(error.conteos.participantes).toBe(1);

    // Ni la clase, ni la fecha, ni la asistencia se movieron.
    expect(await prisma.clase.count({ where: { id: sembrada.claseId } })).toBe(1);
    expect(await prisma.sesion.count({ where: { claseId: sembrada.claseId } })).toBe(1);
    expect(await prisma.asistencia.count({ where: { sesionId: sembrada.sesionId } })).toBe(1);
  });

  it("el resumen importado del Excel tampoco se pierde en silencio", async () => {
    const { eliminarClase, ClaseConAsistenciasError } = await import(
      "@/server/queries/clases"
    );
    const sembrada = await sembrarSesion("Día del niño");
    await prisma.resumenSesion.create({
      data: { sesionId: sembrada.sesionId, ninas: 20, ninos: 18, total: 38 },
    });

    const error = await eliminarClase(sembrada.claseId).catch((e) => e);
    expect(error).toBeInstanceOf(ClaseConAsistenciasError);
    expect(error.conteos.resumenes).toBe(1);
    expect(await prisma.clase.count({ where: { id: sembrada.claseId } })).toBe(1);
  });

  // ── Confirmado por un ADMIN ───────────────────────────────────────────────

  it("forzando se borra todo lo de la sesión y sobrevive lo que es del niño", async () => {
    const { eliminarClase } = await import("@/server/queries/clases");
    const sembrada = await sembrarSesion("Astronomía");
    const niño = await sembrarListaPasada(sembrada.sesionId);
    await prisma.resumenSesion.create({
      data: { sesionId: sembrada.sesionId, ninas: 10, ninos: 11, total: 21 },
    });

    await eliminarClase(sembrada.claseId, { forzar: true });

    expect(await prisma.clase.count({ where: { id: sembrada.claseId } })).toBe(0);
    expect(await prisma.sesion.count({ where: { claseId: sembrada.claseId } })).toBe(0);
    expect(await prisma.asistencia.count({ where: { sesionId: sembrada.sesionId } })).toBe(0);
    expect(await prisma.resumenSesion.count({ where: { sesionId: sembrada.sesionId } })).toBe(0);
    expect(await prisma.imagenClase.count({ where: { claseId: sembrada.claseId } })).toBe(0);
    expect(await prisma.staffClase.count({ where: { claseId: sembrada.claseId } })).toBe(0);

    // El niño y su inscripción en la edición siguen ahí: lo que se borró fue
    // la sesión, no al participante.
    expect(await prisma.participante.count({ where: { id: niño.participanteId } })).toBe(1);
    expect(await prisma.inscripcion.count({ where: { id: niño.inscripcionId } })).toBe(1);
  });

  // ── Que no queden huérfanos en ningún sitio de la base ────────────────────

  it("después de borrar no hay fechas, imágenes ni resúmenes sin dueño", async () => {
    const { eliminarClase } = await import("@/server/queries/clases");
    const sembrada = await sembrarSesion("Corrosión");
    await sembrarListaPasada(sembrada.sesionId);
    await prisma.resumenSesion.create({
      data: { sesionId: sembrada.sesionId, total: 12 },
    });

    await eliminarClase(sembrada.claseId, { forzar: true });

    const claseIds = (
      await prisma.clase.findMany({ select: { id: true } })
    ).map((c) => c.id);
    const sesionIds = (
      await prisma.sesion.findMany({ select: { id: true } })
    ).map((s) => s.id);

    const sesionesHuerfanas = await prisma.sesion.count({
      where: { claseId: { notIn: claseIds.length ? claseIds : ["-"] } },
    });
    const imagenesHuerfanas = await prisma.imagenClase.count({
      where: { claseId: { notIn: claseIds.length ? claseIds : ["-"] } },
    });
    const resumenesHuerfanos = await prisma.resumenSesion.count({
      where: { sesionId: { notIn: sesionIds.length ? sesionIds : ["-"] } },
    });
    const asistenciasHuerfanas = await prisma.asistencia.count({
      where: { sesionId: { notIn: sesionIds.length ? sesionIds : ["-"] } },
    });

    expect({
      sesionesHuerfanas,
      imagenesHuerfanas,
      resumenesHuerfanos,
      asistenciasHuerfanas,
    }).toEqual({
      sesionesHuerfanas: 0,
      imagenesHuerfanas: 0,
      resumenesHuerfanos: 0,
      asistenciasHuerfanas: 0,
    });
  });
});
