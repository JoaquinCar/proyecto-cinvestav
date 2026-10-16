import { describe, it, expect, beforeAll, beforeEach } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// EL CONTADOR DE FUERA, CONTRA BASE REAL.
//
// El reporte del coordinador, literal: «si yo paso lista y luego quito a unos
// niños y los pongo como ausentes, el contador de fuera los sigue contando y
// sumando. Puede que por fuera haya 7, pero por dentro solo 3 están como
// presentes (y los 4 que quité para ver si funcionaba bien)».
//
// La prueba de unidad (tests/unit/queries/contador-asistentes.test.ts) fija el
// `select` que se le manda a Prisma. Esta fija el NÚMERO, que es lo que de
// verdad se le reprocha a la pantalla, y de paso comprueba lo que el
// coordinador creía perdido: que las marcas están guardadas en la base.
//
// Reproduce la secuencia exacta del reporte: 7 presentes, luego 4 de ellos a
// ausentes. Antes del arreglo el contador decía 7; tiene que decir 3.
//
// No se ejecuta por defecto: necesita `PRUEBAS_DB=1` y una base desechable.
// Además se niega a correr si DATABASE_URL no apunta a localhost.
//
//   PRUEBAS_DB=1 \
//   DATABASE_URL="postgresql://postgres:qa_local_pw@localhost:55445/pasaporte" \
//   DIRECT_URL="postgresql://postgres:qa_local_pw@localhost:55445/pasaporte" \
//   npx vitest run tests/integration/db/contador-presentes.test.ts
// ─────────────────────────────────────────────────────────────────────────────

const url = process.env.DATABASE_URL ?? "";
const esLocal = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
const habilitado = process.env.PRUEBAS_DB === "1" && esLocal;

if (process.env.PRUEBAS_DB === "1" && !esLocal) {
  throw new Error(
    "PRUEBAS_DB=1 pero DATABASE_URL no es local: estas pruebas escriben y borran datos.",
  );
}

// Año propio: 2088 y 2089 ya están tomados por las otras pruebas contra base.
const ANIO = 2087;
const MARCA = "QA-CONTADOR-PRESENTES";

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

/** El número que pinta la tarjeta del panel de asistencia para esa fecha. */
async function contadorDeLaTarjeta(sesionId: string): Promise<number> {
  const { listarClasesConSesiones } = await import("@/server/queries/clases");
  const clases = await listarClasesConSesiones(edicionId);
  for (const clase of clases) {
    const fecha = clase.sesiones.find((s) => s.id === sesionId);
    if (fecha) return fecha._count.asistencias;
  }
  throw new Error("la fecha no apareció en el panel");
}

describe.skipIf(!habilitado)("el contador de fuera cuenta presentes", () => {
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

  it("pasar lista y luego quitar a cuatro deja el contador en 3, no en 7", async () => {
    const { batchUpsertAsistencias } = await import("@/server/queries/asistencias");

    const clase = await prisma.clase.create({
      data: { edicionId, nombre: "Astronomía", tipo: "PASAPORTE", investigador: "Dra. Ejemplo" },
    });
    const sesion = await prisma.sesion.create({
      data: { claseId: clase.id, fecha: new Date(`${ANIO}-02-07T00:00:00.000Z`) },
    });

    const inscripciones = [];
    for (const s of ["A", "B", "C", "D", "E", "F", "G"]) {
      inscripciones.push(await inscribirNino(s));
    }

    // 1. Se pasa lista: los siete presentes.
    await batchUpsertAsistencias(
      inscripciones.map((i) => ({
        inscripcionId: i.id,
        sesionId: sesion.id,
        presente: true,
      })),
    );
    expect(await contadorDeLaTarjeta(sesion.id)).toBe(7);

    // 2. Se quitan cuatro: pasan a AUSENTES. La fila no se borra, se le pone
    //    `presente = false` — que es justo lo que inflaba el contador.
    await batchUpsertAsistencias(
      inscripciones.slice(3).map((i) => ({
        inscripcionId: i.id,
        sesionId: sesion.id,
        presente: false,
      })),
    );

    // Lo que el coordinador creía perdido SÍ está en la base: siete filas,
    // tres presentes y cuatro ausentes.
    expect(await prisma.asistencia.count({ where: { sesionId: sesion.id } })).toBe(7);
    expect(
      await prisma.asistencia.count({ where: { sesionId: sesion.id, presente: true } }),
    ).toBe(3);

    // Y el contador de fuera coincide ahora con la lista de dentro.
    expect(await contadorDeLaTarjeta(sesion.id)).toBe(3);

    const { obtenerResumenAsistencia } = await import("@/server/queries/asistencias");
    const dentro = await obtenerResumenAsistencia(sesion.id);
    expect(dentro.presentes).toBe(3);
    expect(await contadorDeLaTarjeta(sesion.id)).toBe(dentro.presentes);
  });

  it("el «N asistentes» de la página de la sesión cuenta lo mismo", async () => {
    const { batchUpsertAsistencias } = await import("@/server/queries/asistencias");
    const { listarSesionesDeClase } = await import("@/server/queries/clases");

    const clase = await prisma.clase.create({
      data: { edicionId, nombre: "Robótica", tipo: "PASAPORTE", investigador: "Dra. Ejemplo" },
    });
    const sesion = await prisma.sesion.create({
      data: { claseId: clase.id, fecha: new Date(`${ANIO}-02-14T00:00:00.000Z`) },
    });

    const presente = await inscribirNino("H");
    const ausente = await inscribirNino("I");

    await batchUpsertAsistencias([
      { inscripcionId: presente.id, sesionId: sesion.id, presente: true },
      { inscripcionId: ausente.id, sesionId: sesion.id, presente: false },
    ]);

    const [fecha] = await listarSesionesDeClase(clase.id);
    expect(fecha!._count.asistencias).toBe(1);
  });

  it("marcar ausente a alguien BAJA el contador, no lo sube", async () => {
    const { batchUpsertAsistencias } = await import("@/server/queries/asistencias");

    const clase = await prisma.clase.create({
      data: { edicionId, nombre: "Química", tipo: "PASAPORTE", investigador: "Dra. Ejemplo" },
    });
    const sesion = await prisma.sesion.create({
      data: { claseId: clase.id, fecha: new Date(`${ANIO}-02-21T00:00:00.000Z`) },
    });
    const nino = await inscribirNino("J");

    await batchUpsertAsistencias([
      { inscripcionId: nino.id, sesionId: sesion.id, presente: true },
    ]);
    const conPresente = await contadorDeLaTarjeta(sesion.id);

    await batchUpsertAsistencias([
      { inscripcionId: nino.id, sesionId: sesion.id, presente: false },
    ]);
    const conAusente = await contadorDeLaTarjeta(sesion.id);

    expect(conPresente).toBe(1);
    expect(conAusente).toBe(0);
    expect(conAusente).toBeLessThan(conPresente);
  });

  it("los acompañantes de la fecha no se mezclan con el conteo de niños", async () => {
    // El contador de mamás y papás (PR #41) es otra cosa y no puede tocar
    // este número: son adultos, no están inscritos y no dan la fecha por
    // capturada.
    const { batchUpsertAsistencias } = await import("@/server/queries/asistencias");
    const { actualizarSesion } = await import("@/server/queries/clases");

    const clase = await prisma.clase.create({
      data: { edicionId, nombre: "Biología", tipo: "PASAPORTE", investigador: "Dra. Ejemplo" },
    });
    const sesion = await prisma.sesion.create({
      data: { claseId: clase.id, fecha: new Date(`${ANIO}-03-07T00:00:00.000Z`) },
    });
    const nino = await inscribirNino("K");

    await batchUpsertAsistencias([
      { inscripcionId: nino.id, sesionId: sesion.id, presente: true },
    ]);
    await actualizarSesion(sesion.id, { acompanantesMamas: 5, acompanantesPapas: 4 });

    expect(await contadorDeLaTarjeta(sesion.id)).toBe(1);
  });
});
