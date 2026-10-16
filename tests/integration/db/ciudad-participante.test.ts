import { describe, it, expect, beforeAll, beforeEach } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// LA CIUDAD DEL PARTICIPANTE — contra base REAL.
//
// El encargo del coordinador: «Al registrar no pide el campo de ciudad, que
// luego se usa en las estadísticas». La columna `Participante.ciudad` existía
// desde el importador de Excel, pero el alta y la edición a mano no la pedían:
// todo niño capturado en la aplicación quedaba sin ciudad y caía en «Sin
// especificar» en la gráfica «Por ciudad».
//
// Lo que se comprueba aquí es lo que no se ve en una prueba de esquema: que lo
// que se escribe llega a la base ya canonizado, que no exigirla no rompe nada
// —en los respaldos hay fichas sin ciudad— y que el desglose junta las grafías
// en vez de partirlas.
//
// No se ejecuta por defecto: necesita `PRUEBAS_DB=1` y una base desechable.
// Además se niega a correr si DATABASE_URL no apunta a localhost.
//
//   PRUEBAS_DB=1 \
//   DATABASE_URL="postgresql://postgres:qa_local_pw@localhost:55445/pasaporte" \
//   DIRECT_URL="postgresql://postgres:qa_local_pw@localhost:55445/pasaporte" \
//   npx vitest run tests/integration/db/ciudad-participante.test.ts
// ─────────────────────────────────────────────────────────────────────────────

const url = process.env.DATABASE_URL ?? "";
const esLocal = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
const habilitado = process.env.PRUEBAS_DB === "1" && esLocal;

if (process.env.PRUEBAS_DB === "1" && !esLocal) {
  throw new Error(
    "PRUEBAS_DB=1 pero DATABASE_URL no es local: estas pruebas escriben y borran datos.",
  );
}

// Año propio: 2090-2098 ya están tomados por las otras pruebas contra base.
const ANIO = 2089;
const MARCA = "QA-CIUDAD";

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
    // Esta prueba no crea actividades, pero una ejecución anterior pudo
    // dejarlas: sin barrerlas, el borrado de la edición choca contra la llave
    // foránea y el fallo no tiene nada que ver con lo que se está probando.
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

async function inscribirNino(sufijo: string, ciudad: string | null) {
  const { crearParticipante } = await import("@/server/queries/participantes");
  const participante = await crearParticipante({
    nombre: `Niñe${sufijo}`,
    apellidos: `De${ANIO}`,
    edad: 9,
    escuela: MARCA,
    grado: "4° primaria",
    genero: "FEMENINO",
    ciudad,
  });
  return prisma.inscripcion.create({
    data: { participanteId: participante.id, edicionId },
  });
}

describe.skipIf(!habilitado)("ciudad del participante", () => {
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

  it("el alta guarda la ciudad, ya canonizada", async () => {
    const { crearParticipante } = await import("@/server/queries/participantes");
    const p = await crearParticipante({
      nombre: "Ana",
      apellidos: `De${ANIO}`,
      edad: 8,
      escuela: MARCA,
      grado: "3° primaria",
      ciudad: "  merida, yuc. ",
    });

    const guardado = await prisma.participante.findUnique({ where: { id: p.id } });
    expect(guardado?.ciudad).toBe("Mérida");
  });

  it("la edición corrige la ciudad sin tocar lo demás", async () => {
    const { crearParticipante, editarParticipante } = await import(
      "@/server/queries/participantes"
    );
    const p = await crearParticipante({
      nombre: "Luis",
      apellidos: `De${ANIO}`,
      edad: 8,
      escuela: MARCA,
      grado: "3° primaria",
      ciudad: "Merida",
    });

    await editarParticipante(p.id, { ciudad: "uman" });

    const guardado = await prisma.participante.findUnique({ where: { id: p.id } });
    expect(guardado?.ciudad).toBe("Umán");
    expect(guardado?.escuela).toBe(MARCA);
    expect(guardado?.nivel).toBe("PRIMARIA");
  });

  it("corregir el nombre no borra la ciudad guardada", async () => {
    const { crearParticipante, editarParticipante } = await import(
      "@/server/queries/participantes"
    );
    const p = await crearParticipante({
      nombre: "Lus",
      apellidos: `De${ANIO}`,
      edad: 8,
      escuela: MARCA,
      grado: "3° primaria",
      ciudad: "Progreso",
    });

    await editarParticipante(p.id, { nombre: "Luz" });

    const guardado = await prisma.participante.findUnique({ where: { id: p.id } });
    expect(guardado?.nombre).toBe("Luz");
    expect(guardado?.ciudad).toBe("Progreso");
  });

  it("deja guardar un participante sin ciudad (los respaldos los traen así)", async () => {
    const { crearParticipante } = await import("@/server/queries/participantes");
    const p = await crearParticipante({
      nombre: "Sin",
      apellidos: `Ciudad${ANIO}`,
      edad: 8,
      escuela: MARCA,
      grado: "3° primaria",
    });
    const guardado = await prisma.participante.findUnique({ where: { id: p.id } });
    expect(guardado?.ciudad).toBeNull();
  });

  it("el desglose por ciudad junta las grafías y nombra a los que no la tienen", async () => {
    const { obtenerMetricasEdicion } = await import("@/server/queries/estadisticas");

    await inscribirNino("A", "Mérida");
    await inscribirNino("B", "merida");
    await inscribirNino("C", "Umán");
    await inscribirNino("D", null);

    const m = await obtenerMetricasEdicion(edicionId);
    const porCiudad = Object.fromEntries(m.porCiudad.map((c) => [c.escuela, c.cantidad]));

    expect(porCiudad["Mérida"]).toBe(2);
    expect(porCiudad["Umán"]).toBe(1);
    expect(porCiudad["Sin especificar"]).toBe(1);
  });

  it("junta también las grafías que ya estaban guardadas sucias", async () => {
    // Las fichas de los respaldos no pasaron por `normalizarCiudad` al
    // escribirse. El desglose las canoniza al leer, así que salen juntas sin
    // reescribir ni una fila.
    const { obtenerMetricasEdicion } = await import("@/server/queries/estadisticas");

    for (const grafia of ["MERIDA", "Mérida, Yuc.", "  mérida "]) {
      const p = await prisma.participante.create({
        data: {
          nombre: `Crudo${grafia.length}`,
          apellidos: `De${ANIO}`,
          edad: 9,
          escuela: MARCA,
          grado: "4° primaria",
          nivel: "PRIMARIA",
          ciudad: grafia,
        },
      });
      await prisma.inscripcion.create({
        data: { participanteId: p.id, edicionId },
      });
    }

    const m = await obtenerMetricasEdicion(edicionId);
    const porCiudad = Object.fromEntries(m.porCiudad.map((c) => [c.escuela, c.cantidad]));

    expect(porCiudad["Mérida"]).toBe(3);
  });
});
