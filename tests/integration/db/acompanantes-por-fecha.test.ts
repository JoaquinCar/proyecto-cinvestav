import { describe, it, expect, beforeAll, beforeEach } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// ACOMPAÑANTES POR FECHA — contra base REAL.
//
// El encargo del coordinador: «De parte de acompañantes está de manera general
// y no por sesiones. O sea, que en la lista se pueda poner cuántos papás y
// mamás fueron a cada sesión. Ojo, solo número, no lista de papás. Y añadir su
// estadística: poner "papás fueron: 4, mamás: 5"».
//
// El tablero enseñaba «Acompañantes 0 · 0 mamás · 0 papás» en cuanto la
// asistencia se capturaba en la aplicación: el dato no existía. Los únicos
// acompañantes que el sistema sabía contar eran los del `ResumenSesion`, que
// solo entra importando el Excel.
//
// Lo que se comprueba aquí es la cadena entera contra la base: que los dos
// números se guardan en la fecha, que no se pisan con los temas, que suman en
// la estadística de la edición, que solo cuentan las sesiones de pasaporte, y
// —lo que no puede romperse— que los números históricos del Excel siguen
// saliendo iguales.
//
// Recordatorio de nombres: en pantalla «sesión» es el modelo `Clase` y «fecha»
// es el modelo `Sesion`.
//
// No se ejecuta por defecto: necesita `PRUEBAS_DB=1` y una base desechable.
// Además se niega a correr si DATABASE_URL no apunta a localhost.
//
//   PRUEBAS_DB=1 \
//   DATABASE_URL="postgresql://postgres:qa_local_pw@localhost:55445/pasaporte" \
//   DIRECT_URL="postgresql://postgres:qa_local_pw@localhost:55445/pasaporte" \
//   npx vitest run tests/integration/db/acompanantes-por-fecha.test.ts
// ─────────────────────────────────────────────────────────────────────────────

const url = process.env.DATABASE_URL ?? "";
const esLocal = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
const habilitado = process.env.PRUEBAS_DB === "1" && esLocal;

if (process.env.PRUEBAS_DB === "1" && !esLocal) {
  throw new Error(
    "PRUEBAS_DB=1 pero DATABASE_URL no es local: estas pruebas escriben y borran datos.",
  );
}

// Año propio: 2089-2098 ya están tomados por las otras pruebas contra base.
const ANIO = 2088;
const MARCA = "QA-ACOMPANANTES";

let prisma: import("@prisma/client").PrismaClient;
let edicionId = "";

async function limpiar() {
  const ediciones = await prisma.edicion.findMany({
    where: { anio: ANIO },
    select: { id: true },
  });
  const ids = ediciones.map((e) => e.id);
  if (ids.length > 0) {
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
  }
  await prisma.participante.deleteMany({ where: { escuela: MARCA } });
}

/** Crea una actividad con su fecha y devuelve los dos ids. */
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

async function inscribirNino(sufijo: string) {
  const participante = await prisma.participante.create({
    data: {
      nombre: `Niñe${sufijo}`,
      apellidos: `De${ANIO}`,
      edad: 9,
      genero: "FEMENINO",
      nivel: "PRIMARIA",
      escuela: MARCA,
      grado: "4° primaria",
    },
  });
  return prisma.inscripcion.create({
    data: { participanteId: participante.id, edicionId },
  });
}

describe.skipIf(!habilitado)("acompañantes por fecha", () => {
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
        minAsistencias: 3,
        activa: false,
      },
    });
    edicionId = edicion.id;
  }, 60_000);

  it("guarda el conteo de mamás y papás de una fecha", async () => {
    const { actualizarSesion } = await import("@/server/queries/clases");
    const { sesionId } = await crearActividad({
      nombre: "Astronomía",
      tipo: "PASAPORTE",
      dia: "02-07",
    });

    await actualizarSesion(sesionId, { acompanantesMamas: 5, acompanantesPapas: 4 });

    const guardada = await prisma.sesion.findUnique({ where: { id: sesionId } });
    expect(guardada?.acompanantesMamas).toBe(5);
    expect(guardada?.acompanantesPapas).toBe(4);
  });

  it("una fecha nace sin contar: NULL, que no es lo mismo que cero", async () => {
    const { sesionId } = await crearActividad({
      nombre: "Robótica",
      tipo: "PASAPORTE",
      dia: "02-14",
    });
    const nueva = await prisma.sesion.findUnique({ where: { id: sesionId } });
    expect(nueva?.acompanantesMamas).toBeNull();
    expect(nueva?.acompanantesPapas).toBeNull();
  });

  it("corregir los temas no borra el conteo de acompañantes", async () => {
    // Son dos formularios distintos sobre la misma fecha: el diálogo de temas y
    // el contador de la pantalla de asistencia. Ninguno puede pisar al otro.
    const { actualizarSesion } = await import("@/server/queries/clases");
    const { sesionId } = await crearActividad({
      nombre: "Química",
      tipo: "PASAPORTE",
      dia: "02-21",
    });

    await actualizarSesion(sesionId, { acompanantesMamas: 3, acompanantesPapas: 2 });
    await actualizarSesion(sesionId, { temas: "Mezclas y disoluciones" });

    const guardada = await prisma.sesion.findUnique({ where: { id: sesionId } });
    expect(guardada?.acompanantesMamas).toBe(3);
    expect(guardada?.temas).toBe("Mezclas y disoluciones");
  });

  it("los acompañantes de cada fecha suman en la estadística de la edición", async () => {
    const { actualizarSesion } = await import("@/server/queries/clases");
    const { obtenerMetricasAsistencia, obtenerAnalisisProfundo } = await import(
      "@/server/queries/estadisticas"
    );

    const inscripcion = await inscribirNino("E");

    const uno = await crearActividad({ nombre: "Física", tipo: "PASAPORTE", dia: "03-07" });
    const dos = await crearActividad({ nombre: "Biología", tipo: "PASAPORTE", dia: "03-14" });
    // Un evento especial, para comprobar que NO entra: solo cuenta pasaporte,
    // igual que el resto de la estadística.
    const fiesta = await crearActividad({ nombre: "Clausura", tipo: "EVENTO", dia: "03-21" });

    for (const s of [uno, dos, fiesta]) {
      await prisma.asistencia.create({
        data: { inscripcionId: inscripcion.id, sesionId: s.sesionId, presente: true },
      });
    }

    await actualizarSesion(uno.sesionId, { acompanantesMamas: 5, acompanantesPapas: 4 });
    await actualizarSesion(dos.sesionId, { acompanantesMamas: 2, acompanantesPapas: 1 });
    await actualizarSesion(fiesta.sesionId, { acompanantesMamas: 90, acompanantesPapas: 90 });

    const asist = await obtenerMetricasAsistencia(edicionId);
    expect(asist.totalMamas).toBe(7);
    expect(asist.totalPapas).toBe(5);

    const analisis = await obtenerAnalisisProfundo(edicionId);
    expect(analisis.totalAcompanantes).toBe(12);
    // El desglose que pidió el coordinador, literal: «papás fueron: 4, mamás: 5».
    expect(analisis.totalMamas).toBe(7);
    expect(analisis.totalPapas).toBe(5);
    expect(analisis.acompanantesPorSesion.map((s) => [s.a, s.b])).toEqual([
      [5, 4],
      [2, 1],
    ]);
  });

  it("el agregado importado del Excel sigue mandando donde no se contó a mano", async () => {
    // Las fechas ya importadas nacen con los campos nuevos en NULL: sus
    // acompañantes siguen saliendo del `ResumenSesion`, con los números de
    // siempre. Esto es lo que no puede romperse al restaurar un respaldo.
    const { obtenerMetricasAsistencia } = await import("@/server/queries/estadisticas");

    const { sesionId } = await crearActividad({
      nombre: "Histórica",
      tipo: "PASAPORTE",
      dia: "04-04",
    });
    await prisma.resumenSesion.create({
      data: { sesionId, ninas: 10, ninos: 12, total: 22, mamas: 18, papas: 7, primaria: 22 },
    });

    const asist = await obtenerMetricasAsistencia(edicionId);
    expect(asist.totalMamas).toBe(18);
    expect(asist.totalPapas).toBe(7);
    expect(asist.sesionesCapturadas).toBe(1);
  });

  it("un 0 del Excel no silencia a los que alguien contó a mano", async () => {
    // Casi todos los `ResumenSesion` traen mamas/papas en 0 porque la hoja del
    // organizador no siempre llevaba esas columnas. Ese 0 por omisión no puede
    // tapar un conteo real.
    const { actualizarSesion } = await import("@/server/queries/clases");
    const { obtenerMetricasAsistencia } = await import("@/server/queries/estadisticas");

    const { sesionId } = await crearActividad({
      nombre: "Mixta",
      tipo: "PASAPORTE",
      dia: "04-18",
    });
    await prisma.resumenSesion.create({
      data: { sesionId, ninas: 10, ninos: 12, total: 22, mamas: 0, papas: 0, primaria: 22 },
    });
    await actualizarSesion(sesionId, { acompanantesMamas: 4, acompanantesPapas: 3 });

    const asist = await obtenerMetricasAsistencia(edicionId);
    expect(asist.totalMamas).toBe(4);
    expect(asist.totalPapas).toBe(3);
    // Para los NIÑOS sigue mandando el agregado: ve también al público que no
    // está inscrito, y la lista de la aplicación no.
    expect(asist.totalEventos).toBe(22);
  });

  it("contar adultos no da por capturada la asistencia de la fecha", async () => {
    // Apuntar que fueron cuatro mamás no es pasar lista: la tarjeta «Asistencia
    // capturada» seguiría mintiendo sobre el trabajo que falta.
    const { actualizarSesion } = await import("@/server/queries/clases");
    const { obtenerMetricasAsistencia } = await import("@/server/queries/estadisticas");

    const { sesionId } = await crearActividad({
      nombre: "Pendiente",
      tipo: "PASAPORTE",
      dia: "04-11",
    });
    await actualizarSesion(sesionId, { acompanantesMamas: 4, acompanantesPapas: 5 });

    const asist = await obtenerMetricasAsistencia(edicionId);
    expect(asist.totalSesiones).toBe(1);
    expect(asist.sesionesCapturadas).toBe(0);
  });
});
