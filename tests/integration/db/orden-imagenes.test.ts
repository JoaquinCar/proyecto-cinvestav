import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// El orden de las fotos, contra una base de datos REAL.
//
// Aquí se prueba justo lo que un mock de Prisma no puede probar:
//
//   · Que la unicidad de (claseId, orden) existe de verdad en Postgres.
//   · Que el reordenado en dos fases sobrevive a esa unicidad — una permutación
//     escrita de un tirón chocaría, porque el índice se comprueba fila a fila.
//   · Que borrar una foto de en medio no deja hueco.
//   · Que el orden de una sesión no interfiere con el de otra.
//
// Sin credenciales de Supabase las imágenes caen en el respaldo de data URI,
// que es justo lo que hace falta para poblar la biblioteca en local.
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

// Año ficticio propio: los archivos de tests/integration/db corren en paralelo
// contra la MISMA base y `Edicion.anio` es único. Repetir el año de otro archivo
// hace que ambos se pisen la edición y fallen sin relación con lo que prueban.
// Ocupados: 2091-2092 (aislamiento), 2093 (clase-con-fecha), 2094 (acompañante),
// 2095 (tipos de sesión).
const ANIO = 2096;

/** PNG de 1x1 px: lo mínimo que acepta `crearImagenClase`. */
const PNG_1X1 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

let prisma: import("@prisma/client").PrismaClient;
let edicionId = "";
let astronomiaId = "";
let clausuraId = "";

async function limpiar() {
  const ediciones = await prisma.edicion.findMany({
    where: { anio: ANIO },
    select: { id: true },
  });
  const ids = ediciones.map((e) => e.id);
  if (ids.length === 0) return;

  // ImagenClase sí está en cascada con Clase, pero se borra explícitamente para
  // que la limpieza no dependa de esa decisión del schema.
  await prisma.imagenClase.deleteMany({
    where: { clase: { edicionId: { in: ids } } },
  });
  await prisma.sesion.deleteMany({ where: { clase: { edicionId: { in: ids } } } });
  await prisma.clase.deleteMany({ where: { edicionId: { in: ids } } });
  await prisma.edicion.deleteMany({ where: { id: { in: ids } } });
}

/** Sube `cuantas` fotos a una sesión y devuelve sus ids, en orden de subida. */
async function subir(claseId: string, cuantas: number): Promise<string[]> {
  const { crearImagenClase } = await import("@/server/queries/imagenes-clase");
  const ids: string[] = [];
  for (let i = 0; i < cuantas; i += 1) {
    const imagen = await crearImagenClase(claseId, {
      mimeType: "image/png",
      data: PNG_1X1,
      titulo: `Foto ${i + 1}`,
    });
    ids.push(imagen.id);
  }
  return ids;
}

/** Cómo está `orden` en la base ahora mismo, de menor a mayor. */
async function ordenEnBase(claseId: string) {
  return prisma.imagenClase.findMany({
    where: { claseId },
    orderBy: { orden: "asc" },
    select: { id: true, orden: true, titulo: true },
  });
}

describe.skipIf(!habilitado)("orden de las fotos de una sesión", () => {
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

    // Dos sesiones distintas, y una de ellas un evento especial: la biblioteca
    // agrupa los tres tipos y el orden de cada una es independiente.
    const astronomia = await prisma.clase.create({
      data: {
        edicionId,
        nombre: "Astronomía para toda la familia",
        tipo: "PASAPORTE",
        investigador: "Dra. Ejemplo",
      },
    });
    astronomiaId = astronomia.id;

    const clausura = await prisma.clase.create({
      data: { edicionId, nombre: "Clausura", tipo: "EVENTO", investigador: null },
    });
    clausuraId = clausura.id;
  });

  afterAll(async () => {
    if (!prisma) return;
    await limpiar();
    await prisma.$disconnect();
  });

  // ── Alta ────────────────────────────────────────────────────────────────────

  it("las fotos nuevas se numeran 0,1,2… sin empates", async () => {
    const ids = await subir(astronomiaId, 5);

    const filas = await ordenEnBase(astronomiaId);
    expect(filas.map((f) => f.orden)).toEqual([0, 1, 2, 3, 4]);
    expect(filas.map((f) => f.id)).toEqual(ids);
  });

  it("Postgres impide dos fotos en la misma posición", async () => {
    const ids = await subir(astronomiaId, 2);

    // Este es el candado: sin él, el "orden" del reporte sería el que saliera.
    await expect(
      prisma.imagenClase.update({ where: { id: ids[1] }, data: { orden: 0 } }),
    ).rejects.toMatchObject({ code: "P2002" });
  });

  // ── Reordenar ───────────────────────────────────────────────────────────────

  it("reordenar persiste en `orden` y deja la secuencia sin huecos", async () => {
    const { reordenarImagenesDeClase } = await import(
      "@/server/queries/imagenes-clase"
    );
    const [a, b, c, d] = await subir(astronomiaId, 4);

    // Una permutación completa: la última pasa a primera y el resto rota. De un
    // solo UPDATE chocaría con la unicidad; por eso el reordenado va en dos fases.
    await reordenarImagenesDeClase(astronomiaId, [d, a, c, b]);

    const filas = await ordenEnBase(astronomiaId);
    expect(filas.map((f) => [f.id, f.orden])).toEqual([
      [d, 0],
      [a, 1],
      [c, 2],
      [b, 3],
    ]);
  });

  it("intercambiar las dos primeras funciona pese a la unicidad", async () => {
    const { reordenarImagenesDeClase } = await import(
      "@/server/queries/imagenes-clase"
    );
    const [a, b, c] = await subir(astronomiaId, 3);

    await reordenarImagenesDeClase(astronomiaId, [b, a, c]);

    const filas = await ordenEnBase(astronomiaId);
    expect(filas.map((f) => f.id)).toEqual([b, a, c]);
    expect(filas.map((f) => f.orden)).toEqual([0, 1, 2]);
  });

  it("reordenar una sesión no toca el orden de otra", async () => {
    const { reordenarImagenesDeClase } = await import(
      "@/server/queries/imagenes-clase"
    );
    const astro = await subir(astronomiaId, 3);
    const clausura = await subir(clausuraId, 3);

    await reordenarImagenesDeClase(astronomiaId, [...astro].reverse());

    expect((await ordenEnBase(astronomiaId)).map((f) => f.id)).toEqual(
      [...astro].reverse(),
    );
    expect((await ordenEnBase(clausuraId)).map((f) => f.id)).toEqual(clausura);
    expect((await ordenEnBase(clausuraId)).map((f) => f.orden)).toEqual([0, 1, 2]);
  });

  it("rechaza una lista que mezcla fotos de otra sesión y no escribe nada", async () => {
    const { reordenarImagenesDeClase, OrdenImagenesInvalidoError } = await import(
      "@/server/queries/imagenes-clase"
    );
    const [a, b] = await subir(astronomiaId, 2);
    const [ajena] = await subir(clausuraId, 1);

    await expect(
      reordenarImagenesDeClase(astronomiaId, [b, ajena]),
    ).rejects.toBeInstanceOf(OrdenImagenesInvalidoError);

    // Intacto: el rechazo es entero, no a medias.
    const filas = await ordenEnBase(astronomiaId);
    expect(filas.map((f) => [f.id, f.orden])).toEqual([
      [a, 0],
      [b, 1],
    ]);
  });

  it("rechaza una lista incompleta: dejaría huecos", async () => {
    const { reordenarImagenesDeClase, OrdenImagenesInvalidoError } = await import(
      "@/server/queries/imagenes-clase"
    );
    const [a, b] = await subir(astronomiaId, 3);

    await expect(
      reordenarImagenesDeClase(astronomiaId, [b, a]),
    ).rejects.toBeInstanceOf(OrdenImagenesInvalidoError);
    expect((await ordenEnBase(astronomiaId)).map((f) => f.orden)).toEqual([0, 1, 2]);
  });

  // ── Borrado ─────────────────────────────────────────────────────────────────

  it("borrar una foto de en medio compacta el orden", async () => {
    const { eliminarImagenClase } = await import("@/server/queries/imagenes-clase");
    const [a, b, c, d] = await subir(astronomiaId, 4);

    await eliminarImagenClase(b);

    const filas = await ordenEnBase(astronomiaId);
    expect(filas.map((f) => [f.id, f.orden])).toEqual([
      [a, 0],
      [c, 1],
      [d, 2],
    ]);
  });

  it("tras borrar, la siguiente foto que se sube no choca", async () => {
    const { eliminarImagenClase } = await import("@/server/queries/imagenes-clase");
    const [, b] = await subir(astronomiaId, 3);

    await eliminarImagenClase(b);
    await subir(astronomiaId, 1);

    expect((await ordenEnBase(astronomiaId)).map((f) => f.orden)).toEqual([0, 1, 2]);
  });

  // ── Lo que ve la biblioteca ────────────────────────────────────────────────

  it("la biblioteca agrupa por sesión y respeta el orden guardado", async () => {
    const { reordenarImagenesDeClase, listarImagenesDeEdicionPorSesion } =
      await import("@/server/queries/imagenes-clase");

    const astro = await subir(astronomiaId, 3);
    await subir(clausuraId, 2);
    await reordenarImagenesDeClase(astronomiaId, [astro[2], astro[0], astro[1]]);

    const grupos = await listarImagenesDeEdicionPorSesion(edicionId);

    expect(grupos).toHaveLength(2);
    const galeriaAstro = grupos.find((g) => g.claseId === astronomiaId)!;
    expect(galeriaAstro.imagenes.map((i) => i.id)).toEqual([
      astro[2],
      astro[0],
      astro[1],
    ]);

    // El evento entra en la biblioteca como una sesión más, sin investigador.
    const galeriaClausura = grupos.find((g) => g.claseId === clausuraId)!;
    expect(galeriaClausura.tipo).toBe("EVENTO");
    expect(galeriaClausura.investigador).toBeNull();
    expect(galeriaClausura.imagenes).toHaveLength(2);

    // Nunca sale la referencia interna de Storage ni la ruta del bucket.
    const serializado = JSON.stringify(grupos);
    expect(serializado).not.toContain("supabase://");
    expect(serializado).not.toContain("storagePath");
  });
});
