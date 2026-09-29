import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// Los tres tipos de actividad, contra una base de datos REAL.
//
// El programa tiene tres cosas distintas que en pantalla se llaman todas
// «sesión»: la charla de pasaporte, la sesión de lectura (un extra opcional) y
// el evento especial (día del niño, clausura). Un mismo día puede haber una
// charla Y además el evento.
//
// Lo que se prueba aquí es lo que ningún mock puede probar:
//   • que la columna `tipo` deje como PASAPORTE lo que ya existía, sin backfill;
//   • que una charla y un evento el MISMO día no se estorben;
//   • que la asistencia a lectura y a evento NO sume al mínimo de la constancia.
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
const MARCA = "QA-TIPOS-SESION";

let prisma: import("@prisma/client").PrismaClient;
let edicionId = "";

/** Borra solo lo sembrado por esta prueba (edición del año ficticio). */
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

/** Inscribe un niño nuevo en la edición de prueba y devuelve su inscripción. */
async function inscribirNino(sufijo: string) {
  const participante = await prisma.participante.create({
    data: {
      nombre: `Niñe${sufijo}`,
      apellidos: `De${ANIO}`,
      edad: 9,
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
  tipo?: "PASAPORTE" | "LECTURA" | "EVENTO";
  investigador?: string | null;
  dia: string;
}) {
  const clase = await prisma.clase.create({
    data: {
      edicionId,
      nombre: opts.nombre,
      // `tipo` se omite adrede cuando no viene: así se prueba el DEFAULT.
      ...(opts.tipo !== undefined && { tipo: opts.tipo }),
      investigador: opts.investigador === undefined ? "Dra. Ejemplo" : opts.investigador,
    },
  });
  const sesion = await prisma.sesion.create({
    data: { claseId: clase.id, fecha: new Date(`${ANIO}-${opts.dia}T00:00:00.000Z`) },
  });
  return { claseId: clase.id, sesionId: sesion.id };
}

describe.skipIf(!habilitado)("tipos de sesión contra la base real", () => {
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
        fechaInicio: new Date(`${ANIO}-02-01T00:00:00.000Z`),
        fechaFin: new Date(`${ANIO}-06-30T00:00:00.000Z`),
        // Tres asistencias de pasaporte bastan para la constancia.
        minAsistencias: 3,
        activa: false,
      },
    });
    edicionId = edicion.id;
  });

  afterAll(async () => {
    if (!prisma) return;
    await limpiar();
    await prisma.$disconnect();
  });

  // ── Crear de cada tipo ──────────────────────────────────────────────────────

  it("crea una sesión de cada tipo desde la capa de consultas", async () => {
    const { crearClaseConSesion } = await import("@/server/queries/clases");

    const pasaporte = await crearClaseConSesion({
      edicionId,
      nombre: "¿Cuántos años tienen los peces?",
      tipo: "PASAPORTE",
      investigador: "Dra. Ejemplo",
      fecha: new Date(`${ANIO}-03-14T00:00:00.000Z`),
    });
    const lectura = await crearClaseConSesion({
      edicionId,
      nombre: "Lectura: El principito",
      tipo: "LECTURA",
      investigador: "Dra. Lectora",
      fecha: new Date(`${ANIO}-03-21T00:00:00.000Z`),
    });
    const evento = await crearClaseConSesion({
      edicionId,
      nombre: "Clausura",
      tipo: "EVENTO",
      investigador: null,
      fecha: new Date(`${ANIO}-06-20T00:00:00.000Z`),
    });

    const filas = await prisma.clase.findMany({
      where: { id: { in: [pasaporte.id, lectura.id, evento.id] } },
      select: { id: true, tipo: true, investigador: true },
    });
    const porId = new Map(filas.map((f) => [f.id, f]));

    expect(porId.get(pasaporte.id)?.tipo).toBe("PASAPORTE");
    expect(porId.get(lectura.id)?.tipo).toBe("LECTURA");
    expect(porId.get(evento.id)?.tipo).toBe("EVENTO");

    // Una clausura no la imparte ningún investigador: la columna lo admite.
    expect(porId.get(evento.id)?.investigador).toBeNull();
    expect(porId.get(pasaporte.id)?.investigador).toBe("Dra. Ejemplo");

    // Y cada una nació con su fecha, como cualquier sesión.
    for (const id of [pasaporte.id, lectura.id, evento.id]) {
      expect(await prisma.sesion.count({ where: { claseId: id } })).toBe(1);
    }
  });

  it("lo que se crea sin decir el tipo queda como sesión de pasaporte", async () => {
    // Es el caso de las 12 sesiones que ya existen en producción: la columna
    // nace con DEFAULT 'PASAPORTE' y nadie tuvo que tocarlas.
    const { claseId } = await crearActividad({ nombre: "Heredada", dia: "03-14" });
    const clase = await prisma.clase.findUnique({ where: { id: claseId } });
    expect(clase?.tipo).toBe("PASAPORTE");
  });

  it("una charla y un evento pueden caer el mismo día sin estorbarse", async () => {
    const charla = await crearActividad({
      nombre: "Robótica",
      tipo: "PASAPORTE",
      dia: "04-30",
    });
    const evento = await crearActividad({
      nombre: "Día del niño",
      tipo: "EVENTO",
      investigador: null,
      dia: "04-30",
    });

    expect(charla.claseId).not.toBe(evento.claseId);
    expect(charla.sesionId).not.toBe(evento.sesionId);

    const delDia = await prisma.sesion.findMany({
      where: {
        fecha: new Date(`${ANIO}-04-30T00:00:00.000Z`),
        clase: { edicionId },
      },
      select: { id: true, clase: { select: { tipo: true } } },
    });
    expect(delDia.map((s) => s.clase.tipo).sort()).toEqual(["EVENTO", "PASAPORTE"]);
  });

  // ── Filtrar por tipo ────────────────────────────────────────────────────────

  it("el listado sabe filtrar por tipo", async () => {
    const { listarClasesDeEdicion } = await import("@/server/queries/clases");

    await crearActividad({ nombre: "Charla A", tipo: "PASAPORTE", dia: "03-01" });
    await crearActividad({ nombre: "Charla B", tipo: "PASAPORTE", dia: "03-08" });
    await crearActividad({ nombre: "Lectura", tipo: "LECTURA", dia: "03-15" });
    await crearActividad({
      nombre: "Clausura",
      tipo: "EVENTO",
      investigador: null,
      dia: "06-20",
    });

    const todas = await listarClasesDeEdicion(edicionId);
    expect(todas).toHaveLength(4);

    const eventos = await listarClasesDeEdicion(edicionId, "EVENTO");
    expect(eventos.map((c) => c.nombre)).toEqual(["Clausura"]);
    expect(eventos[0].tipo).toBe("EVENTO");

    const pasaporte = await listarClasesDeEdicion(edicionId, "PASAPORTE");
    expect(pasaporte.map((c) => c.nombre)).toEqual(["Charla A", "Charla B"]);

    const lectura = await listarClasesDeEdicion(edicionId, "LECTURA");
    expect(lectura.map((c) => c.nombre)).toEqual(["Lectura"]);
  });

  // ── LA regla: qué cuenta para la constancia ─────────────────────────────────

  it("la asistencia a lectura y a evento NO suma al mínimo de la constancia", async () => {
    const { verificarElegibilidad } = await import("@/server/queries/constancias");

    const p1 = await crearActividad({ nombre: "Charla 1", tipo: "PASAPORTE", dia: "03-01" });
    const p2 = await crearActividad({ nombre: "Charla 2", tipo: "PASAPORTE", dia: "03-08" });
    const lectura = await crearActividad({ nombre: "Lectura", tipo: "LECTURA", dia: "03-15" });
    const evento = await crearActividad({
      nombre: "Día del niño",
      tipo: "EVENTO",
      investigador: null,
      dia: "04-30",
    });

    // Va a TODO: dos charlas, la lectura y el evento. Son 4 asistencias en
    // total, pero solo 2 de pasaporte, y el mínimo de la edición es 3.
    const inscripcion = await inscribirNino("Completo");
    await prisma.asistencia.createMany({
      data: [p1, p2, lectura, evento].map((a) => ({
        inscripcionId: inscripcion.id,
        sesionId: a.sesionId,
        presente: true,
      })),
    });

    expect(await prisma.asistencia.count({ where: { inscripcionId: inscripcion.id } })).toBe(4);

    const antes = await verificarElegibilidad(inscripcion.id);
    expect(antes?.asistencias).toBe(2);
    expect(antes?.minimo).toBe(3);
    expect(antes?.elegible).toBe(false);

    // Una charla más —de pasaporte— sí lo cruza.
    const p3 = await crearActividad({ nombre: "Charla 3", tipo: "PASAPORTE", dia: "03-22" });
    await prisma.asistencia.create({
      data: { inscripcionId: inscripcion.id, sesionId: p3.sesionId, presente: true },
    });

    const despues = await verificarElegibilidad(inscripcion.id);
    expect(despues?.asistencias).toBe(3);
    expect(despues?.elegible).toBe(true);
  });

  it("el denominador del porcentaje mínimo solo cuenta sesiones de pasaporte", async () => {
    const { verificarElegibilidad } = await import("@/server/queries/constancias");

    // 2 de pasaporte + 2 extras. Con el 100% exigido, ir a las 2 de pasaporte
    // basta: los extras no pueden empujar a nadie por debajo del umbral.
    await prisma.edicion.update({
      where: { id: edicionId },
      data: { porcentajeMinimo: 100 },
    });

    const p1 = await crearActividad({ nombre: "Charla 1", tipo: "PASAPORTE", dia: "03-01" });
    const p2 = await crearActividad({ nombre: "Charla 2", tipo: "PASAPORTE", dia: "03-08" });
    await crearActividad({ nombre: "Lectura", tipo: "LECTURA", dia: "03-15" });
    await crearActividad({
      nombre: "Clausura",
      tipo: "EVENTO",
      investigador: null,
      dia: "06-20",
    });

    const inscripcion = await inscribirNino("Puntual");
    await prisma.asistencia.createMany({
      data: [p1, p2].map((a) => ({
        inscripcionId: inscripcion.id,
        sesionId: a.sesionId,
        presente: true,
      })),
    });

    const r = await verificarElegibilidad(inscripcion.id);
    expect(r?.modo).toBe("porcentaje");
    expect(r?.asistencias).toBe(2);
    expect(r?.elegible).toBe(true);
  });

  it("las asistencias a cada tipo quedan guardadas por separado", async () => {
    // Que no cuenten para la constancia no significa que se pierdan: el
    // registro del evento existe y se puede contar aparte.
    const charla = await crearActividad({ nombre: "Charla", tipo: "PASAPORTE", dia: "04-30" });
    const evento = await crearActividad({
      nombre: "Día del niño",
      tipo: "EVENTO",
      investigador: null,
      dia: "04-30",
    });

    const inscripcion = await inscribirNino("Ambas");
    await prisma.asistencia.createMany({
      data: [charla, evento].map((a) => ({
        inscripcionId: inscripcion.id,
        sesionId: a.sesionId,
        presente: true,
      })),
    });

    const porTipo = await prisma.asistencia.groupBy({
      by: ["sesionId"],
      where: { inscripcionId: inscripcion.id },
      _count: true,
    });
    expect(porTipo).toHaveLength(2);

    const enEvento = await prisma.asistencia.count({
      where: {
        inscripcionId: inscripcion.id,
        sesion: { clase: { tipo: "EVENTO" } },
      },
    });
    const enPasaporte = await prisma.asistencia.count({
      where: {
        inscripcionId: inscripcion.id,
        sesion: { clase: { tipo: "PASAPORTE" } },
      },
    });
    expect(enEvento).toBe(1);
    expect(enPasaporte).toBe(1);
  });

  // ── Estadísticas ────────────────────────────────────────────────────────────

  it("las métricas separan las sesiones por tipo", async () => {
    const { obtenerMetricasEdicion } = await import("@/server/queries/estadisticas");

    await crearActividad({ nombre: "Charla A", tipo: "PASAPORTE", dia: "03-01" });
    await crearActividad({ nombre: "Charla B", tipo: "PASAPORTE", dia: "03-08" });
    await crearActividad({ nombre: "Lectura", tipo: "LECTURA", dia: "03-15" });
    await crearActividad({
      nombre: "Clausura",
      tipo: "EVENTO",
      investigador: null,
      dia: "06-20",
    });

    const m = await obtenerMetricasEdicion(edicionId);

    expect(m.totalSesiones).toBe(4);
    expect(m.totalSesionesPasaporte).toBe(2);
    expect(m.porTipo).toEqual([
      { tipo: "PASAPORTE", sesiones: 2, asistencias: 0 },
      { tipo: "LECTURA", sesiones: 1, asistencias: 0 },
      { tipo: "EVENTO", sesiones: 1, asistencias: 0 },
    ]);
  });
});
