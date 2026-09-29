import { prisma } from "@/server/db";
import type { StaffInput } from "@/lib/schemas/staff.schema";

// ─────────────────────────────────────────────────────────────────────────────
// Staff: quien IMPARTE U ORGANIZA una sesión.
//
// Vocabulario, porque aquí es donde más confunde: en pantalla «sesión» es el
// modelo `Clase` (la charla) y «fecha» es el modelo `Sesion`. El staff se
// asigna a la SESIÓN —o sea a `Clase`—, no a cada fecha: quien da la charla la
// da completa. Por eso el enlace es `StaffClase` y las rutas cuelgan de
// /api/clases/[id]/staff.
//
// Una persona de staff es una ficha GLOBAL, igual que `Participante` y que
// `Acompanante`: existe una sola vez y se reutiliza en todas las sesiones y en
// todas las ediciones. Ese es el punto entero de la función — el mismo becario
// estará en veinte sesiones, y si hubiera que teclearlo veinte veces la lista
// se llenaría de "Rocío Canul", "Rocio Canul" y "R. Canul" y no serviría para
// nada. La edición no se pierde: se deduce por las sesiones a las que está
// asignado, igual que la de un acompañante se deduce por sus inscripciones.
// ─────────────────────────────────────────────────────────────────────────────

// ── Errores de dominio ────────────────────────────────────────────────────────

export class StaffNoEncontradoError extends Error {
  constructor(message = "Persona de staff no encontrada") {
    super(message);
    this.name = "StaffNoEncontradoError";
  }
}

/** La `Clase` —la «sesión» de la interfaz— no existe. */
export class SesionNoEncontradaError extends Error {
  constructor(message = "Sesión no encontrada") {
    super(message);
    this.name = "SesionNoEncontradaError";
  }
}

export class AsignacionNoEncontradaError extends Error {
  constructor(message = "Esa persona no está asignada a esta sesión") {
    super(message);
    this.name = "AsignacionNoEncontradaError";
  }
}

// ── Tipos ─────────────────────────────────────────────────────────────────────

export type StaffBuscado = Awaited<ReturnType<typeof buscarStaff>>[number];
export type StaffConSesiones = Awaited<ReturnType<typeof obtenerStaff>>;

/** Elección de staff: alguien que ya existe, o alguien nuevo por crear. */
export type EleccionStaff =
  | { staffId: string; staff?: never }
  | { staffId?: never; staff: StaffInput };

/** Campos que se devuelven de una persona en cualquier respuesta. */
const CAMPOS_STAFF = {
  id:          true,
  nombre:      true,
  apellidos:   true,
  telefono:    true,
  correo:      true,
  rol:         true,
  institucion: true,
} as const;

// ── Buscar (typeahead para reutilizar) ───────────────────────────────────────
// Búsqueda GLOBAL, sin acotar por edición, por lo mismo que en
// `buscarAcompanantes`: lo que se quiere encontrar es justo a quien ya se
// capturó antes — hace tres años o hace cinco minutos, al armar la sesión
// anterior.

const LIMITE_BUSQUEDA = 50;

export async function buscarStaff(q?: string) {
  const texto = q?.trim();

  return prisma.staff.findMany({
    where: texto
      ? {
          OR: [
            { nombre:      { contains: texto, mode: "insensitive" as const } },
            { apellidos:   { contains: texto, mode: "insensitive" as const } },
            { correo:      { contains: texto, mode: "insensitive" as const } },
            { institucion: { contains: texto, mode: "insensitive" as const } },
          ],
        }
      : {},
    orderBy: [{ nombre: "asc" }, { apellidos: "asc" }],
    take: LIMITE_BUSQUEDA,
    select: {
      ...CAMPOS_STAFF,
      // En cuántas sesiones participa: es lo que distingue a la becaria de
      // siempre de un homónimo capturado por error el año pasado.
      _count: { select: { sesiones: true } },
    },
  });
}

// ── Alta suelta ───────────────────────────────────────────────────────────────
// Dar de alta a alguien sin asignarlo todavía: el coordinador arma la plantilla
// del año antes de que existan las sesiones.

export async function crearStaff(data: StaffInput) {
  return prisma.staff.create({
    data: {
      nombre:      data.nombre,
      apellidos:   data.apellidos   ?? null,
      telefono:    data.telefono    ?? null,
      correo:      data.correo      ?? null,
      institucion: data.institucion ?? null,
      rol:         data.rol,
    },
    select: CAMPOS_STAFF,
  });
}

// ── Ficha: en qué sesiones participa ──────────────────────────────────────────

export async function obtenerStaff(id: string) {
  return prisma.staff.findUnique({
    where: { id },
    select: {
      ...CAMPOS_STAFF,
      sesiones: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          clase: {
            select: {
              id:      true,
              nombre:  true,
              edicion: { select: { id: true, anio: true, nombre: true, activa: true } },
            },
          },
        },
      },
    },
  });
}

// ── Resolver la elección a un id ──────────────────────────────────────────────
// Punto ÚNICO donde se decide entre reutilizar y crear. Vive aquí, y no
// repetido en cada ruta, para que no haya un segundo camino capaz de crear
// fichas duplicadas sin que nadie se entere. Mismo papel que
// `resolverAcompanante`.

export async function resolverStaff(eleccion: EleccionStaff): Promise<string> {
  if (eleccion.staff) {
    const creada = await crearStaff(eleccion.staff);
    return creada.id;
  }

  const existente = await prisma.staff.findUnique({
    where:  { id: eleccion.staffId },
    select: { id: true },
  });
  if (!existente) throw new StaffNoEncontradoError();
  return existente.id;
}

// ── Quién está asignado a una sesión ─────────────────────────────────────────

export async function listarStaffDeClase(claseId: string) {
  const asignaciones = await prisma.staffClase.findMany({
    where:   { claseId },
    orderBy: { createdAt: "asc" },
    select:  { id: true, createdAt: true, staff: { select: CAMPOS_STAFF } },
  });

  return asignaciones.map((a) => ({ ...a.staff, asignadoEl: a.createdAt }));
}

// ── Asignar a una sesión ──────────────────────────────────────────────────────

export async function asignarStaffAClase(
  claseId: string,
  eleccion: EleccionStaff,
) {
  const clase = await prisma.clase.findUnique({
    where:  { id: claseId },
    select: { id: true },
  });
  if (!clase) throw new SesionNoEncontradaError();

  const staffId = await resolverStaff(eleccion);

  // `upsert` y no `create`: asignar dos veces a la misma persona a la misma
  // sesión —dos becarios capturando a la vez, o un doble toque en el teléfono—
  // no es un error que haya que contarle a nadie, es una operación que ya
  // estaba hecha. La unicidad real la garantiza @@unique([staffId, claseId]).
  return prisma.staffClase.upsert({
    where:  { staffId_claseId: { staffId, claseId } },
    update: {},
    create: { staffId, claseId },
    select: {
      id:      true,
      claseId: true,
      staffId: true,
      staff:   { select: CAMPOS_STAFF },
    },
  });
}

// ── Quitar de una sesión ──────────────────────────────────────────────────────
// Solo desasigna. La ficha de la persona NO se borra: casi siempre está en
// otras sesiones, y aunque no lo esté, el año que viene se reutiliza. Es el
// mismo criterio que `quitarAcompanante`.

export async function quitarStaffDeClase(claseId: string, staffId: string) {
  const asignacion = await prisma.staffClase.findUnique({
    where:  { staffId_claseId: { staffId, claseId } },
    select: { id: true },
  });
  if (!asignacion) throw new AsignacionNoEncontradaError();

  await prisma.staffClase.delete({
    where: { staffId_claseId: { staffId, claseId } },
  });
}
