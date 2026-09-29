import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// El informe en Word, de punta a punta y contra una base de datos REAL.
//
// Es lo que un mock no puede dar: que la consulta, el orden de las fotos, el
// número de sesión y el anexo salgan de filas de verdad. Comprueba además las
// dos cosas que más caro costarían si se rompieran:
//
//   · Que el BANNER institucional sigue dentro del .docx generado.
//   · Que NINGÚN teléfono ni correo del staff llega al documento, aunque en la
//     base estén capturados. `obtenerDatosInformeSesion` pide la lista sin
//     contacto a propósito; esta prueba es el candado de esa decisión.
//
// No se ejecuta por defecto: necesita `PRUEBAS_DB=1` y una base desechable.
// Además se niega a correr si DATABASE_URL no apunta a localhost.
//
//   PRUEBAS_DB=1 \
//   DATABASE_URL="postgresql://postgres:qa_local_pw@localhost:55445/pasaporte" \
//   DIRECT_URL="postgresql://postgres:qa_local_pw@localhost:55445/pasaporte" \
//   npx vitest run tests/integration/db/informe-word.test.ts
// ─────────────────────────────────────────────────────────────────────────────

const url = process.env.DATABASE_URL ?? "";
const esLocal = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
const habilitado = process.env.PRUEBAS_DB === "1" && esLocal;

if (process.env.PRUEBAS_DB === "1" && !esLocal) {
  throw new Error(
    "PRUEBAS_DB=1 pero DATABASE_URL no es local: estas pruebas escriben y borran datos.",
  );
}

// Un año propio, que no use ninguna otra prueba de tests/integration/db: los
// archivos corren EN PARALELO contra la MISMA base y `Edicion.anio` es único,
// así que compartir año hace que dos pruebas se borren los datos entre sí.
const ANIO = 2090;
/** Marca para poder borrar SOLO lo que siembra esta prueba. */
const MARCA = "ZZ-PRUEBA-INFORME";

const TELEFONO = "9991234567";
const CORREO = "staff.zz@example.com";

let prisma: import("@prisma/client").PrismaClient;
let charlaId = "";
let eventoId = "";

/** PNG de cabecera válida; el contenido da igual, solo se comprueba el orden. */
function png(ancho: number, alto: number, relleno: number): Buffer {
  const cabecera = Buffer.alloc(24);
  cabecera.writeUInt32BE(0x89504e47, 0);
  cabecera.writeUInt32BE(0x0d0a1a0a, 4);
  cabecera.writeUInt32BE(13, 8);
  cabecera.write("IHDR", 12, "ascii");
  cabecera.writeUInt32BE(ancho, 16);
  cabecera.writeUInt32BE(alto, 20);
  return Buffer.concat([cabecera, Buffer.alloc(8, relleno)]);
}

function dataUri(relleno: number): string {
  return `data:image/png;base64,${png(1200, 900, relleno).toString("base64")}`;
}

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
      await prisma.imagenClase.deleteMany({ where: { claseId: { in: claseIds } } });
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

/** Texto plano del documento, como lo leería alguien al abrirlo en Word. */
function textoVisible(xml: string): string {
  return (xml.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) ?? [])
    .map((t) => t.replace(/<[^>]+>/g, ""))
    .join("\n");
}

async function generar(claseId: string) {
  const { obtenerDatosInformeSesion } = await import("@/server/queries/informe-sesion");
  const { generarInformeSesionWord } = await import("@/lib/word/informe-sesion");
  const { leerZip } = await import("@/lib/word/zip");

  const informe = await obtenerDatosInformeSesion(claseId);
  expect(informe).not.toBeNull();

  const documento = await generarInformeSesionWord(informe!.datos);
  const entradas = leerZip(documento);

  return {
    informe: informe!,
    documento,
    entradas,
    nombres: entradas.map((e) => e.nombre),
    xml: entradas
      .find((e) => e.nombre === "word/document.xml")!
      .datos.toString("utf8"),
  };
}

describe.skipIf(!habilitado)("informe de sesión en Word contra base real", () => {
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
        fechaInicio: new Date(`${ANIO}-01-01T00:00:00.000Z`),
        fechaFin: new Date(`${ANIO}-06-30T00:00:00.000Z`),
      },
    });

    // Dos charlas ANTES de la que se exporta, para que su número sea el 3 y no
    // el 1: el número es una posición en el calendario, no un contador.
    for (const [indice, dia] of ["10", "20"].entries()) {
      await prisma.clase.create({
        data: {
          edicionId: edicion.id,
          nombre: `Charla previa ${indice + 1} ${MARCA}`,
          investigador: "Alguien",
          sesiones: { create: { fecha: new Date(`${ANIO}-01-${dia}T00:00:00.000Z`) } },
        },
      });
    }

    const charla = await prisma.clase.create({
      data: {
        edicionId: edicion.id,
        nombre: "Los misteriosos gusanos marinos",
        tipo: "PASAPORTE",
        investigador: "Mayra Vázquez Luna",
        descripcion: "Los gusanos marinos son invertebrados.\nViven escondidos.",
        objetivo: "Descubrir que existen muchos tipos de gusanos marinos.",
        comentarios: "1. La plática despertó el interés.\n2. La integración fue buena.",
        sesiones: { create: { fecha: new Date(`${ANIO}-02-21T00:00:00.000Z`) } },
      },
    });
    charlaId = charla.id;

    // Un evento especial: no lo imparte nadie y no tiene fotos ni textos.
    const evento = await prisma.clase.create({
      data: {
        edicionId: edicion.id,
        nombre: "Clausura del Pasaporte",
        tipo: "EVENTO",
        investigador: null,
        sesiones: { create: { fecha: new Date(`${ANIO}-06-20T00:00:00.000Z`) } },
      },
    });
    eventoId = evento.id;

    // Tres fotos, capturadas en un orden y COLOCADAS en otro: es lo que hace
    // que la prueba distinga «orden de captura» de «orden del reporte».
    await prisma.imagenClase.createMany({
      data: [
        { claseId: charla.id, url: dataUri(3), titulo: "Tercera", mimeType: "image/png", orden: 2 },
        { claseId: charla.id, url: dataUri(1), titulo: "Portada", mimeType: "image/png", orden: 0 },
        { claseId: charla.id, url: dataUri(2), titulo: "Segunda", mimeType: "image/png", orden: 1 },
      ],
    });

    // Staff CON teléfono y correo capturados: el documento no debe llevarlos.
    const staff = await prisma.staff.create({
      data: {
        nombre: "Rocío",
        apellidos: MARCA,
        rol: "BECARIO",
        institucion: "CINVESTAV Mérida",
        telefono: TELEFONO,
        correo: CORREO,
      },
    });
    await prisma.staffClase.create({ data: { claseId: charla.id, staffId: staff.id } });

    // Dos niños inscritos; solo uno asiste.
    const fecha = await prisma.sesion.findFirstOrThrow({ where: { claseId: charla.id } });

    for (const [indice, nombre] of ["Ana", "Luis"].entries()) {
      const participante = await prisma.participante.create({
        data: {
          nombre,
          apellidos: MARCA,
          edad: 9 + indice,
          escuela: `Primaria ${nombre}`,
          grado: `${4 + indice}º`,
        },
      });
      const inscripcion = await prisma.inscripcion.create({
        data: { participanteId: participante.id, edicionId: edicion.id },
      });
      if (indice === 0) {
        await prisma.asistencia.create({
          data: { inscripcionId: inscripcion.id, sesionId: fecha.id, presente: true },
        });
      }
    }
  }, 60_000);

  afterAll(async () => {
    if (!prisma) return;
    await limpiar();
    await prisma.$disconnect();
  });

  it("genera un .docx con el banner y sin un solo marcador sin resolver", async () => {
    const { documento, nombres, xml, entradas } = await generar(charlaId);

    expect(documento.subarray(0, 2).toString("ascii")).toBe("PK");
    expect(xml).not.toContain("{{");

    const banner = entradas.find((e) => e.nombre === "word/media/image1.png");
    expect(banner).toBeDefined();
    expect(banner!.datos.length).toBeGreaterThan(100_000);
    expect(nombres).toContain("word/styles.xml");
  });

  it("numera la sesión por su posición en el calendario de su edición", async () => {
    const { informe, xml } = await generar(charlaId);

    expect(informe.datos.numeroSesion).toBe("3");
    expect(informe.nombreArchivo).toBe(
      `Informe_sesion_3_${ANIO}_los-misteriosos-gusanos-marinos`,
    );
    expect(textoVisible(xml)).toContain("Sesión: 3");
    expect(textoVisible(xml)).toContain("21 de febrero");
  });

  it("imprime las fotos en el orden de `orden`, no en el de captura", async () => {
    const { xml, entradas } = await generar(charlaId);
    const texto = textoVisible(xml);

    // La de `orden` 0 es la portada y no va en la galería.
    expect(texto).not.toContain("Portada");
    expect(texto.indexOf("Segunda")).toBeGreaterThan(-1);
    expect(texto.indexOf("Segunda")).toBeLessThan(texto.indexOf("Tercera"));

    // Y los bytes de cada una son los suyos: la portada es la foto 1, no la 3.
    const portada = entradas.find((e) => e.nombre === "word/media/informe-0.png");
    expect(portada!.datos.equals(png(1200, 900, 1))).toBe(true);
    const primeraGaleria = entradas.find((e) => e.nombre === "word/media/informe-1.png");
    expect(primeraGaleria!.datos.equals(png(1200, 900, 2))).toBe(true);
  });

  it("anexa quién asistió y quién impartió, sin teléfono ni correo", async () => {
    const { xml, informe } = await generar(charlaId);
    const texto = textoVisible(xml);

    // Solo el niño que asistió; el otro está inscrito pero no vino.
    expect(informe.datos.anexo!.ninos).toHaveLength(1);
    expect(texto).toContain("Niñas y niños que asistieron (1)");
    expect(texto).toContain("Ana");
    // Luis está INSCRITO pero no vino: el anexo dice quién asistió, no quién
    // se había apuntado.
    expect(texto).not.toContain("Luis");
    expect(texto).toContain("Staff de la sesión (1)");
  });

  it("no deja escapar el contacto del staff al documento", async () => {
    const { xml, documento } = await generar(charlaId);

    expect(xml).not.toContain(TELEFONO);
    expect(xml).not.toContain(CORREO);
    // Ni siquiera en otra parte del paquete (propiedades, relaciones…).
    expect(documento.includes(Buffer.from(TELEFONO))).toBe(false);

    // Lo que sí sale: quién es y de dónde.
    expect(textoVisible(xml)).toContain("Rocío");
    expect(textoVisible(xml)).toContain("CINVESTAV Mérida");
  });

  it("un evento sin investigador ni fotos sale entero y sin huecos", async () => {
    const { xml, nombres } = await generar(eventoId);
    const texto = textoVisible(xml);

    expect(texto).toContain("Clausura del Pasaporte");
    expect(texto).not.toContain("Autor:");
    expect(texto).not.toContain("null");
    expect(texto).not.toContain("Fotos de la sesión");
    expect(texto).not.toContain("Objetivo:");
    expect(texto).not.toContain("Comentarios");
    expect(xml).not.toContain("{{");

    // Sin fotos propias, en el paquete solo queda el banner.
    expect(nombres.filter((n) => n.startsWith("word/media/"))).toEqual([
      "word/media/image1.png",
    ]);

    // Es el primer (y único) evento de la edición, y lleva su tipo al lado para
    // no confundirse con la sesión 1 del pasaporte.
    expect(texto).toContain("Sesión: 1 · Evento especial");
  });
});
