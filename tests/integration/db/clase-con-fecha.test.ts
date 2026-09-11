import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// Una clase nace con su sesión, contra una base de datos REAL.
//
// En el programa una clase ES una charla impartida en una fecha. Crearla debe
// dejarla lista para pasar lista: clase + sesión, en una sola transacción. Lo
// que se prueba aquí es justo lo que un mock no puede probar — que si la sesión
// falla, la clase no queda suelta.
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

const ANIO = 2093;

let prisma: import("@prisma/client").PrismaClient;
let edicionId = "";

/** Borra solo lo sembrado por esta prueba (edición del año ficticio). */
async function limpiar() {
  const ediciones = await prisma.edicion.findMany({
    where: { anio: ANIO },
    select: { id: true },
  });
  const ids = ediciones.map((e) => e.id);
  if (ids.length === 0) return;

  await prisma.asistencia.deleteMany({
    where: { sesion: { clase: { edicionId: { in: ids } } } },
  });
  await prisma.resumenSesion.deleteMany({
    where: { sesion: { clase: { edicionId: { in: ids } } } },
  });
  await prisma.sesion.deleteMany({ where: { clase: { edicionId: { in: ids } } } });
  await prisma.clase.deleteMany({ where: { edicionId: { in: ids } } });
  await prisma.edicion.deleteMany({ where: { id: { in: ids } } });
}

describe.skipIf(!habilitado)("crear una clase deja clase y sesión", () => {
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
        minAsistencias: 4,
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

  it("crea la clase y su sesión en el mismo paso", async () => {
    const { crearClaseConSesion } = await import("@/server/queries/clases");

    const clase = await crearClaseConSesion({
      edicionId,
      nombre: "¿Cuántos años tienen los peces?",
      investigador: "Dra. Ejemplo",
      fecha: new Date(`${ANIO}-03-14T00:00:00.000Z`),
      descripcion: "Cómo se lee la edad en una escama",
    });

    const sesiones = await prisma.sesion.findMany({ where: { claseId: clase.id } });
    expect(sesiones).toHaveLength(1);
    expect(sesiones[0].fecha.toISOString()).toBe(`${ANIO}-03-14T00:00:00.000Z`);
    expect(clase.sesionId).toBe(sesiones[0].id);
  });

  it("no deja la clase suelta si falla la creación de la sesión", async () => {
    const { crearClaseConSesion } = await import("@/server/queries/clases");

    // `registradaPorId` apunta a un usuario inexistente: la clase se inserta y
    // la sesión revienta por clave foránea. Si no hubiera transacción, quedaría
    // una clase sin sesión — exactamente el estado que se quiere imposibilitar.
    await expect(
      crearClaseConSesion(
        {
          edicionId,
          nombre: "Clase que no debe quedar",
          investigador: "Dr. Fantasma",
          fecha: new Date(`${ANIO}-03-14T00:00:00.000Z`),
        },
        "usuario-que-no-existe",
      ),
    ).rejects.toThrow();

    const clases = await prisma.clase.findMany({ where: { edicionId } });
    expect(clases).toHaveLength(0);
  });

  it("editar la clase corrige la fecha de su única sesión", async () => {
    const { crearClaseConSesion, editarClase } = await import(
      "@/server/queries/clases"
    );

    const clase = await crearClaseConSesion({
      edicionId,
      nombre: "Corrosión",
      investigador: "Dr. Ejemplo",
      fecha: new Date(`${ANIO}-03-14T00:00:00.000Z`),
    });

    await editarClase(clase.id, { fecha: new Date(`${ANIO}-04-18T00:00:00.000Z`) });

    const sesiones = await prisma.sesion.findMany({ where: { claseId: clase.id } });
    expect(sesiones).toHaveLength(1);
    expect(sesiones[0].fecha.toISOString()).toBe(`${ANIO}-04-18T00:00:00.000Z`);
  });

  it("editar la fecha de una clase heredada sin sesiones le crea la sesión", async () => {
    const { editarClase } = await import("@/server/queries/clases");

    // Clase creada por el flujo viejo: nació sin sesión y no se le podía pasar
    // lista. Editarle la fecha la repara en vez de dejarla inservible.
    const huerfana = await prisma.clase.create({
      data: { edicionId, nombre: "Clase heredada", investigador: "Dra. Antigua" },
    });

    await editarClase(huerfana.id, { fecha: new Date(`${ANIO}-05-09T00:00:00.000Z`) });

    const sesiones = await prisma.sesion.findMany({ where: { claseId: huerfana.id } });
    expect(sesiones).toHaveLength(1);
    expect(sesiones[0].fecha.toISOString()).toBe(`${ANIO}-05-09T00:00:00.000Z`);
  });

  it("se niega a adivinar la fecha cuando la clase tiene varias sesiones", async () => {
    const { editarClase, VariasSesionesError } = await import(
      "@/server/queries/clases"
    );

    const clase = await prisma.clase.create({
      data: { edicionId, nombre: "Taller largo", investigador: "Dr. Ejemplo" },
    });
    await prisma.sesion.createMany({
      data: [
        { claseId: clase.id, fecha: new Date(`${ANIO}-03-01T00:00:00.000Z`) },
        { claseId: clase.id, fecha: new Date(`${ANIO}-03-08T00:00:00.000Z`) },
      ],
    });

    await expect(
      editarClase(clase.id, {
        nombre: "Taller renombrado",
        fecha: new Date(`${ANIO}-04-01T00:00:00.000Z`),
      }),
    ).rejects.toBeInstanceOf(VariasSesionesError);

    // Y el rechazo no deja el nombre cambiado a medias.
    const despues = await prisma.clase.findUnique({ where: { id: clase.id } });
    expect(despues?.nombre).toBe("Taller largo");

    const fechas = (
      await prisma.sesion.findMany({
        where: { claseId: clase.id },
        orderBy: { fecha: "asc" },
      })
    ).map((s) => s.fecha.toISOString());
    expect(fechas).toEqual([
      `${ANIO}-03-01T00:00:00.000Z`,
      `${ANIO}-03-08T00:00:00.000Z`,
    ]);
  });
});
