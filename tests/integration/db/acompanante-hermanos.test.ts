import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// Dos hermanos, un solo acompañante — contra una base de datos REAL.
//
// Es la prueba que un mock no puede dar: que al inscribir al segundo hermano
// con el acompañante del primero quede UNA sola fila en Acompanante y DOS
// inscripciones apuntando a ella. Si se duplicara, la ficha del acompañante
// mostraría a un hijo en vez de a los dos y la función no serviría.
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
/** Marca para poder borrar SOLO lo que siembra esta prueba. */
const MARCA = "ZZ-PRUEBA-ACOMPANANTE";

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
    await prisma.inscripcion.deleteMany({ where: { edicionId: { in: ids } } });
    await prisma.edicion.deleteMany({ where: { id: { in: ids } } });
  }

  // Filtro por la marca: nunca un deleteMany sin `where`.
  await prisma.participante.deleteMany({ where: { apellidos: MARCA } });
  await prisma.acompanante.deleteMany({ where: { apellidos: MARCA } });
}

describe.skipIf(!habilitado)("dos hermanos comparten un solo acompañante", () => {
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
        activa: true,
      },
    });
    edicionId = edicion.id;
  });

  afterAll(async () => {
    if (!prisma) return;
    await limpiar();
    await prisma.$disconnect();
  });

  async function crearNino(nombre: string) {
    return prisma.participante.create({
      data: {
        nombre,
        apellidos: MARCA,
        edad: 9,
        escuela: "Primaria de prueba",
        grado: "4° primaria",
      },
    });
  }

  it("el segundo hermano reutiliza la ficha del primero, no la duplica", async () => {
    const { inscribirParticipante } = await import("@/server/queries/participantes");

    const ana = await crearNino("Ana");
    const beto = await crearNino("Beto");

    // Primer hermano: el acompañante se captura por primera vez.
    const primera = await inscribirParticipante(ana.id, edicionId, {
      acompanante: {
        nombre: "Laura",
        apellidos: MARCA,
        telefono: "9990000000",
        parentesco: "MADRE",
      },
    });
    expect(primera.acompananteId).toBeTruthy();

    // Segundo hermano: se elige al que ya existe.
    const segunda = await inscribirParticipante(beto.id, edicionId, {
      acompananteId: primera.acompananteId!,
    });

    expect(segunda.acompananteId).toBe(primera.acompananteId);

    const fichas = await prisma.acompanante.findMany({
      where: { apellidos: MARCA },
    });
    expect(fichas).toHaveLength(1);

    const conHijos = await prisma.acompanante.findUnique({
      where: { id: fichas[0].id },
      include: { inscripciones: true },
    });
    expect(conHijos?.inscripciones).toHaveLength(2);
  });

  it("cambiar y quitar el acompañante de una inscripción", async () => {
    const { inscribirParticipante } = await import("@/server/queries/participantes");
    const { asignarAcompanante, quitarAcompanante } = await import(
      "@/server/queries/acompanantes"
    );

    const ana = await crearNino("Ana");
    const inscripcion = await inscribirParticipante(ana.id, edicionId, {
      acompanante: { nombre: "Laura", apellidos: MARCA, parentesco: "MADRE" },
    });

    // 2027 vino con la abuela: se cambia el acompañante de ESTA inscripción.
    const cambiada = await asignarAcompanante(inscripcion.id, {
      acompanante: { nombre: "Rosa", apellidos: MARCA, parentesco: "ABUELA" },
    });
    expect(cambiada.acompanante?.nombre).toBe("Rosa");
    expect(cambiada.acompananteId).not.toBe(inscripcion.acompananteId);

    // La ficha de la mamá NO se borra al dejar de estar ligada.
    const laura = await prisma.acompanante.findUnique({
      where: { id: inscripcion.acompananteId! },
    });
    expect(laura).not.toBeNull();

    const sinAcompanante = await quitarAcompanante(inscripcion.id);
    expect(sinAcompanante.acompananteId).toBeNull();

    // Y la abuela tampoco desaparece al quitarla.
    expect(
      await prisma.acompanante.findUnique({ where: { id: cambiada.acompananteId! } }),
    ).not.toBeNull();
  });

  it("dar de baja a un hermano no borra al acompañante del otro", async () => {
    const { inscribirParticipante, desinscribirParticipante } = await import(
      "@/server/queries/participantes"
    );

    const ana = await crearNino("Ana");
    const beto = await crearNino("Beto");

    const primera = await inscribirParticipante(ana.id, edicionId, {
      acompanante: { nombre: "Laura", apellidos: MARCA, parentesco: "MADRE" },
    });
    await inscribirParticipante(beto.id, edicionId, {
      acompananteId: primera.acompananteId!,
    });

    await desinscribirParticipante(primera.id);

    const acompanante = await prisma.acompanante.findUnique({
      where: { id: primera.acompananteId! },
      include: { inscripciones: true },
    });

    expect(acompanante).not.toBeNull();
    expect(acompanante?.inscripciones).toHaveLength(1);
  });

  it("un grupo organizado acompaña a muchos niños con una sola ficha", async () => {
    const { inscribirParticipante } = await import("@/server/queries/participantes");
    const { obtenerAcompanante } = await import("@/server/queries/acompanantes");

    const ninos = await Promise.all(
      Array.from({ length: 6 }, (_, i) => crearNino(`Nino${i}`)),
    );

    const primera = await inscribirParticipante(ninos[0].id, edicionId, {
      acompanante: {
        nombre: "Grupo de prueba",
        apellidos: MARCA,
        parentesco: "GRUPO",
      },
    });

    for (const n of ninos.slice(1)) {
      await inscribirParticipante(n.id, edicionId, {
        acompananteId: primera.acompananteId!,
      });
    }

    const ficha = await obtenerAcompanante(primera.acompananteId!);
    expect(ficha?.parentesco).toBe("GRUPO");
    expect(ficha?.inscripciones).toHaveLength(6);
  });
});
