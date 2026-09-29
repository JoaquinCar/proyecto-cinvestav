import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// La misma persona de staff en DOS sesiones — contra una base de datos REAL.
//
// Es la prueba que un mock no puede dar, y es la que decide si esta función se
// usa o se abandona: un becario estará en veinte sesiones, y al asignarlo a la
// segunda tiene que quedar UNA sola fila en "Staff" y DOS en "StaffClase". Si
// naciera una ficha por sesión, la lista que se anexa al documento de la sesión
// se llenaría de "Rocío Canul", "Rocio Canul" y "R. Canul", y no serviría.
//
// Comprueba además que quitar a alguien de una sesión NO borra su ficha.
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

const ANIO = 2097;
/** Marca para poder borrar SOLO lo que siembra esta prueba. */
const MARCA = "ZZ-PRUEBA-STAFF";

let prisma: import("@prisma/client").PrismaClient;
let edicionId = "";
let sesionA = "";
let sesionB = "";
let fechaA = "";

async function limpiar() {
  const ediciones = await prisma.edicion.findMany({
    where: { anio: ANIO },
    select: { id: true },
  });
  const ids = ediciones.map((e) => e.id);

  if (ids.length > 0) {
    const clases = await prisma.clase.findMany({
      where: { edicionId: { in: ids } },
      select: { id: true },
    });
    const claseIds = clases.map((c) => c.id);

    if (claseIds.length > 0) {
      await prisma.asistencia.deleteMany({
        where: { sesion: { claseId: { in: claseIds } } },
      });
      await prisma.staffClase.deleteMany({ where: { claseId: { in: claseIds } } });
      await prisma.sesion.deleteMany({ where: { claseId: { in: claseIds } } });
    }

    await prisma.inscripcion.deleteMany({ where: { edicionId: { in: ids } } });
    await prisma.clase.deleteMany({ where: { edicionId: { in: ids } } });
    await prisma.edicion.deleteMany({ where: { id: { in: ids } } });
  }

  // Filtro por la marca: nunca un deleteMany sin `where`.
  await prisma.participante.deleteMany({ where: { apellidos: MARCA } });
  await prisma.staff.deleteMany({ where: { apellidos: MARCA } });
}

describe.skipIf(!habilitado)("una persona de staff en varias sesiones", () => {
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
      },
    });
    edicionId = edicion.id;

    const a = await prisma.clase.create({
      data: {
        edicionId,
        nombre: "Astronomía para todos",
        investigador: "Dra. de prueba",
      },
    });
    const b = await prisma.clase.create({
      data: {
        edicionId,
        nombre: "Robótica para todos",
        investigador: "Dra. de prueba",
      },
    });
    sesionA = a.id;
    sesionB = b.id;

    const fecha = await prisma.sesion.create({
      data: { claseId: a.id, fecha: new Date(`${ANIO}-03-07T00:00:00.000Z`) },
    });
    fechaA = fecha.id;
  });

  afterAll(async () => {
    if (!prisma) return;
    await limpiar();
    await prisma.$disconnect();
  });

  it("asignarla a dos sesiones deja UNA sola ficha y DOS asignaciones", async () => {
    const { asignarStaffAClase } = await import("@/server/queries/staff");

    // Primera sesión: se captura por primera vez.
    const primera = await asignarStaffAClase(sesionA, {
      staff: {
        nombre: "Rocío",
        apellidos: MARCA,
        telefono: "9997654321",
        correo: "rocio.zz@example.com",
        institucion: "CINVESTAV Mérida",
        rol: "BECARIO",
      },
    });
    expect(primera.staffId).toBeTruthy();

    // Segunda sesión: se elige a quien ya existe. Aquí es donde nacerían los
    // duplicados si la reutilización no funcionara.
    const segunda = await asignarStaffAClase(sesionB, {
      staffId: primera.staffId,
    });
    expect(segunda.staffId).toBe(primera.staffId);

    const fichas = await prisma.staff.findMany({ where: { apellidos: MARCA } });
    expect(fichas).toHaveLength(1);

    const asignaciones = await prisma.staffClase.findMany({
      where: { staffId: fichas[0].id },
    });
    expect(asignaciones).toHaveLength(2);
    expect(asignaciones.map((a) => a.claseId).sort()).toEqual(
      [sesionA, sesionB].sort(),
    );
  });

  it("volver a asignar a quien ya estaba no duplica la asignación", async () => {
    const { asignarStaffAClase } = await import("@/server/queries/staff");

    const primera = await asignarStaffAClase(sesionA, {
      staff: { nombre: "Rocío", apellidos: MARCA, rol: "BECARIO" },
    });
    await asignarStaffAClase(sesionA, { staffId: primera.staffId });
    await asignarStaffAClase(sesionA, { staffId: primera.staffId });

    const asignaciones = await prisma.staffClase.count({
      where: { staffId: primera.staffId, claseId: sesionA },
    });
    expect(asignaciones).toBe(1);
  });

  it("quitarla de una sesión NO borra su ficha ni sus otras asignaciones", async () => {
    const { asignarStaffAClase, quitarStaffDeClase } = await import(
      "@/server/queries/staff"
    );

    const asignada = await asignarStaffAClase(sesionA, {
      staff: { nombre: "Rocío", apellidos: MARCA, rol: "BECARIO" },
    });
    await asignarStaffAClase(sesionB, { staffId: asignada.staffId });

    await quitarStaffDeClase(sesionB, asignada.staffId);

    // La ficha sigue viva: el año que viene se reutiliza.
    const ficha = await prisma.staff.findUnique({
      where: { id: asignada.staffId },
    });
    expect(ficha).not.toBeNull();

    // Y sigue en la otra sesión.
    const restantes = await prisma.staffClase.findMany({
      where: { staffId: asignada.staffId },
    });
    expect(restantes).toHaveLength(1);
    expect(restantes[0].claseId).toBe(sesionA);
  });

  it("la lista de la sesión devuelve los niños asistentes Y el staff", async () => {
    const { asignarStaffAClase } = await import("@/server/queries/staff");
    const { obtenerListaDeSesion } = await import(
      "@/server/queries/listas-sesion"
    );

    await asignarStaffAClase(sesionA, {
      staff: {
        nombre: "Rocío",
        apellidos: MARCA,
        telefono: "9997654321",
        rol: "BECARIO",
      },
    });
    await asignarStaffAClase(sesionA, {
      staff: { nombre: "Juan", apellidos: MARCA, rol: "INVESTIGADOR" },
    });

    // Un niño que asistió y otro inscrito que NO: solo el primero sale.
    const vino = await prisma.participante.create({
      data: {
        nombre: "Ana",
        apellidos: MARCA,
        edad: 9,
        escuela: "Primaria de prueba",
        grado: "4° primaria",
      },
    });
    const noVino = await prisma.participante.create({
      data: {
        nombre: "Beto",
        apellidos: MARCA,
        edad: 10,
        escuela: "Primaria de prueba",
        grado: "5° primaria",
      },
    });

    const inscripcion = await prisma.inscripcion.create({
      data: { participanteId: vino.id, edicionId },
    });
    await prisma.inscripcion.create({
      data: { participanteId: noVino.id, edicionId },
    });
    await prisma.asistencia.create({
      data: { inscripcionId: inscripcion.id, sesionId: fechaA, presente: true },
    });

    const lista = await obtenerListaDeSesion(sesionA);

    expect(lista).not.toBeNull();
    expect(lista!.ninos.map((n) => n.nombre)).toEqual(["Ana"]);
    expect(lista!.staff.map((s) => s.nombre).sort()).toEqual(["Juan", "Rocío"]);
    expect(lista!.totales).toEqual({ ninos: 1, staff: 2, fechas: 1 });

    // Por omisión el contacto del staff no viaja.
    expect(lista!.staff.every((s) => s.telefono === null)).toBe(true);

    const conContacto = await obtenerListaDeSesion(sesionA, {
      incluirContactoStaff: true,
    });
    expect(conContacto!.staff.some((s) => s.telefono === "9997654321")).toBe(true);
  });

  it("el buscador dice en cuántas sesiones está cada persona", async () => {
    const { asignarStaffAClase, buscarStaff } = await import(
      "@/server/queries/staff"
    );

    const asignada = await asignarStaffAClase(sesionA, {
      staff: { nombre: "Rocío", apellidos: MARCA, rol: "BECARIO" },
    });
    await asignarStaffAClase(sesionB, { staffId: asignada.staffId });

    const encontrada = (await buscarStaff(MARCA)).find(
      (s) => s.id === asignada.staffId,
    );
    expect(encontrada?._count.sesiones).toBe(2);
  });
});
