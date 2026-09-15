import { prisma } from "@/server/db";
import type { AcompananteInput } from "@/lib/schemas/acompanante.schema";

// ─────────────────────────────────────────────────────────────────────────────
// Acompañantes: el adulto —o el grupo organizado— con el que llega el niño.
//
// Un acompañante es una PERSONA global, igual que un Participante: existe una
// sola vez y se reutiliza entre hermanos y entre ediciones. El enlace con el
// año concreto vive en Inscripcion.acompananteId, porque quién acompaña cambia:
// un niño puede venir con su mamá en 2026 y con su abuela en 2027.
//
// Todo el diseño gira alrededor de la reutilización: si al inscribir al segundo
// hermano hubiera que volver a teclear los datos del adulto, se crearían
// duplicados y la ficha "a quién acompaña" dejaría de servir.
// ─────────────────────────────────────────────────────────────────────────────

// ── Errores de dominio ────────────────────────────────────────────────────────

export class AcompananteNoEncontradoError extends Error {
  constructor(message = "Acompañante no encontrado") {
    super(message);
    this.name = "AcompananteNoEncontradoError";
  }
}

export class InscripcionNoEncontradaError extends Error {
  constructor(message = "Inscripción no encontrada") {
    super(message);
    this.name = "InscripcionNoEncontradaError";
  }
}

// ── Tipos ─────────────────────────────────────────────────────────────────────

export type AcompananteBuscado = Awaited<
  ReturnType<typeof buscarAcompanantes>
>[number];

export type AcompananteConAcompanados = Awaited<
  ReturnType<typeof obtenerAcompanante>
>;

/** Elección de acompañante: uno que ya existe, o uno nuevo por crear. */
export type EleccionAcompanante =
  | { acompananteId: string; acompanante?: never }
  | { acompananteId?: never; acompanante: AcompananteInput };

// ── Buscar acompañantes (typeahead para reutilizar) ──────────────────────────
// Mismo patrón que `buscarParticipantes`: la búsqueda es global, sin acotar por
// edición, porque lo que se quiere encontrar es justo a quien ya se capturó
// antes — el año pasado o hace cinco minutos, al registrar al hermano mayor.

const LIMITE_BUSQUEDA = 50;

export async function buscarAcompanantes(q?: string) {
  const texto = q?.trim();

  return prisma.acompanante.findMany({
    where: texto
      ? {
          OR: [
            { nombre:    { contains: texto, mode: "insensitive" as const } },
            { apellidos: { contains: texto, mode: "insensitive" as const } },
            { telefono:  { contains: texto, mode: "insensitive" as const } },
          ],
        }
      : {},
    orderBy: [{ nombre: "asc" }, { apellidos: "asc" }],
    take: LIMITE_BUSQUEDA,
    select: {
      id:         true,
      nombre:     true,
      apellidos:  true,
      telefono:   true,
      correo:     true,
      parentesco: true,
      // A cuántos niños acompaña: es lo que distingue "Laura Pérez (2 niños)"
      // del "Grupo Zarigüeyas (25 niños)" cuando hay dos nombres parecidos.
      _count: { select: { inscripciones: true } },
    },
  });
}

// ── Ficha: a quién acompaña ───────────────────────────────────────────────────
// La vista que convierte esto en algo útil: de un vistazo, los 25 niños de un
// grupo o los 2 hermanos, con la edición de cada uno.

export async function obtenerAcompanante(id: string) {
  return prisma.acompanante.findUnique({
    where: { id },
    include: {
      inscripciones: {
        select: {
          id: true,
          participante: {
            select: {
              id:        true,
              nombre:    true,
              apellidos: true,
              edad:      true,
              escuela:   true,
              grado:     true,
            },
          },
          edicion: {
            select: { id: true, anio: true, nombre: true, activa: true },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });
}

// ── Resolver la elección a un id ──────────────────────────────────────────────
// Punto único donde se decide entre reutilizar y crear. Vive aquí, y no
// repetido en cada ruta, para que no haya un segundo camino que cree fichas
// duplicadas sin querer.

export async function resolverAcompanante(
  eleccion: EleccionAcompanante,
): Promise<string> {
  if (eleccion.acompanante) {
    const creado = await prisma.acompanante.create({
      data: {
        nombre:     eleccion.acompanante.nombre,
        apellidos:  eleccion.acompanante.apellidos ?? null,
        telefono:   eleccion.acompanante.telefono ?? null,
        correo:     eleccion.acompanante.correo ?? null,
        parentesco: eleccion.acompanante.parentesco,
      },
    });
    return creado.id;
  }

  const existente = await prisma.acompanante.findUnique({
    where:  { id: eleccion.acompananteId },
    select: { id: true },
  });
  if (!existente) throw new AcompananteNoEncontradoError();
  return existente.id;
}

/** Lo que devuelven asignar / quitar: la inscripción con su acompañante. */
const INSCRIPCION_CON_ACOMPANANTE = {
  id:            true,
  acompananteId: true,
  acompanante: {
    select: {
      id:         true,
      nombre:     true,
      apellidos:  true,
      telefono:   true,
      correo:     true,
      parentesco: true,
    },
  },
} as const;

// ── Asignar o cambiar el acompañante de una inscripción ──────────────────────

export async function asignarAcompanante(
  inscripcionId: string,
  eleccion: EleccionAcompanante,
) {
  const inscripcion = await prisma.inscripcion.findUnique({
    where:  { id: inscripcionId },
    select: { id: true },
  });
  if (!inscripcion) throw new InscripcionNoEncontradaError();

  const acompananteId = await resolverAcompanante(eleccion);

  return prisma.inscripcion.update({
    where:  { id: inscripcionId },
    data:   { acompananteId },
    select: INSCRIPCION_CON_ACOMPANANTE,
  });
}

// ── Quitar el acompañante de una inscripción ──────────────────────────────────
// Solo desliga. La ficha del acompañante NO se borra: casi siempre acompaña a
// más niños, y aunque no lo haga, el año que viene se reutiliza.

export async function quitarAcompanante(inscripcionId: string) {
  const inscripcion = await prisma.inscripcion.findUnique({
    where:  { id: inscripcionId },
    select: { id: true },
  });
  if (!inscripcion) throw new InscripcionNoEncontradaError();

  return prisma.inscripcion.update({
    where:  { id: inscripcionId },
    data:   { acompananteId: null },
    select: INSCRIPCION_CON_ACOMPANANTE,
  });
}
