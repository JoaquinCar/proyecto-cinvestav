import { prisma } from "@/server/db";
import type {
  CrearClaseInput,
  EditarClaseInput,
  CrearSesionInput,
  ActualizarSesionInput,
} from "@/lib/schemas/clase.schema";

// ── Tipos de retorno ──────────────────────────────────────────────────────────

export type ClaseConConteos = Awaited<ReturnType<typeof listarClasesDeEdicion>>[number];
export type SesionDetalle   = Awaited<ReturnType<typeof listarSesionesDeClase>>[number];

// ── Listar clases de una edición con conteos ──────────────────────────────────

export async function listarClasesDeEdicion(edicionId: string) {
  return prisma.clase.findMany({
    where:   { edicionId },
    orderBy: { createdAt: "asc" },
    select: {
      id:           true,
      edicionId:    true,
      nombre:       true,
      investigador: true,
      descripcion:  true,
      createdAt:    true,
      // Las fechas viajan con la clase: la tarjeta muestra el día en que se
      // imparte, que es lo que la persona reconoce.
      sesiones: {
        orderBy: { fecha: "asc" as const },
        select:  { fecha: true },
      },
      _count: {
        select: {
          sesiones: true,
        },
      },
    },
  });
}

// ── Clases con sus sesiones (hub de asistencia) ───────────────────────────────

export async function listarClasesConSesiones(edicionId: string) {
  return prisma.clase.findMany({
    where: { edicionId },
    orderBy: { nombre: "asc" },
    select: {
      id: true,
      nombre: true,
      investigador: true,
      sesiones: {
        orderBy: { fecha: "asc" },
        select: {
          id: true,
          fecha: true,
          temas: true,
          _count: { select: { asistencias: true } },
        },
      },
    },
  });
}

// ── Obtener una clase por ID ──────────────────────────────────────────────────

export async function obtenerClasePorId(id: string) {
  return prisma.clase.findUnique({
    where: { id },
    select: {
      id:           true,
      edicionId:    true,
      nombre:       true,
      investigador: true,
      descripcion:  true,
      createdAt:    true,
      _count: {
        select: {
          sesiones: true,
        },
      },
    },
  });
}

// ── Crear una clase con su sesión ─────────────────────────────────────────────

/**
 * Crea la clase y la sesión en la que se imparte, en una sola transacción.
 *
 * En el programa una clase ES una charla en una fecha: las 12 clases reales
 * tienen exactamente una sesión, y sus nombres son títulos de charla. Antes la
 * clase nacía con cero sesiones y era inservible —no se le podía pasar lista—
 * hasta que alguien le "agregaba" una desde el detalle. La transacción es lo
 * que impide que vuelva a existir ese estado intermedio: si la sesión falla, la
 * clase tampoco se guarda.
 */
export async function crearClaseConSesion(
  data: CrearClaseInput,
  registradaPorId?: string,
) {
  return prisma.$transaction(async (tx) => {
    const clase = await tx.clase.create({
      data: {
        edicionId:    data.edicionId,
        nombre:       data.nombre,
        investigador: data.investigador,
        descripcion:  data.descripcion ?? null,
      },
    });

    const sesion = await tx.sesion.create({
      data: {
        claseId:         clase.id,
        // El schema ya normalizó la fecha a medianoche UTC del día de calendario.
        fecha:           data.fecha,
        temas:           data.temas ?? null,
        registradaPorId: registradaPorId ?? null,
      },
    });

    return { ...clase, sesionId: sesion.id };
  });
}

// ── Editar una clase existente ────────────────────────────────────────────────

/**
 * Edita los datos de la clase y, si viene `fecha`, la de su sesión.
 *
 * La fecha se corrige desde aquí porque el detalle de la clase ya no ofrece
 * "Agregar Sesión": sin esto, un dedazo en la fecha quedaría permanente.
 *
 * Los tres casos posibles de una clase:
 *   • Una sesión (lo normal): se le cambia la fecha.
 *   • Ninguna (clases del flujo viejo): se le crea, y así queda utilizable.
 *   • Varias: no hay forma de saber cuál cambiar, así que se rechaza y cada una
 *     se edita desde su tarjeta en el detalle de la clase.
 */
export async function editarClase(
  id: string,
  data: EditarClaseInput,
  registradaPorId?: string,
) {
  const campos = {
    ...(data.nombre       !== undefined && { nombre:       data.nombre }),
    ...(data.investigador !== undefined && { investigador: data.investigador }),
    ...(data.descripcion  !== undefined && { descripcion:  data.descripcion }),
  };

  if (data.fecha === undefined) {
    return prisma.clase.update({ where: { id }, data: campos });
  }

  const fecha = data.fecha;

  return prisma.$transaction(async (tx) => {
    const clase = await tx.clase.update({ where: { id }, data: campos });

    const sesiones = await tx.sesion.findMany({
      where:   { claseId: id },
      orderBy: { fecha: "asc" },
      select:  { id: true },
    });

    if (sesiones.length > 1) {
      throw new VariasSesionesError(
        `Esta clase tiene ${sesiones.length} sesiones: cambia la fecha de cada una ` +
        `desde su tarjeta en la página de la clase.`,
      );
    }

    if (sesiones.length === 0) {
      await tx.sesion.create({
        data: { claseId: id, fecha, registradaPorId: registradaPorId ?? null },
      });
    } else {
      await tx.sesion.update({ where: { id: sesiones[0].id }, data: { fecha } });
    }

    return clase;
  });
}

// ── Eliminar una clase (solo si no tiene sesiones ni asistencias) ─────────────

export async function eliminarClase(id: string) {
  // Contar asistencias a través de sesiones de esta clase
  const asistencias = await prisma.asistencia.count({
    where: {
      sesion: { claseId: id },
    },
  });

  if (asistencias > 0) {
    throw new ClaseConAsistenciasError(
      `No se puede eliminar la clase porque tiene ${asistencias} asistencia(s) registrada(s). ` +
        "Ese es el respaldo de las constancias de los niños y no se borra desde aquí.",
    );
  }

  // Sesion → Clase no está en cascada (a propósito: borrar una clase no debe
  // llevarse por delante el calendario). Sin esta comprobación, el `delete`
  // reventaba contra la llave foránea y salía como "Error interno del
  // servidor", sin decir que lo que estorbaba eran las sesiones.
  const sesiones = await prisma.sesion.count({ where: { claseId: id } });

  if (sesiones > 0) {
    throw new ClaseConSesionesError(
      `No se puede eliminar la clase porque tiene ${sesiones} sesión(es) programada(s). ` +
        "Elimina primero esas sesiones desde la página de la clase y vuelve a intentarlo.",
      sesiones,
    );
  }

  return prisma.clase.delete({ where: { id } });
}

// ── Listar sesiones de una clase ──────────────────────────────────────────────

export async function listarSesionesDeClase(claseId: string) {
  return prisma.sesion.findMany({
    where:   { claseId },
    orderBy: { fecha: "asc" },
    select: {
      id:              true,
      claseId:         true,
      fecha:           true,
      temas:           true,
      notas:           true,
      registradaPorId: true,
      createdAt:       true,
      _count: {
        select: {
          asistencias: true,
        },
      },
    },
  });
}

// ── Obtener una sesión por ID ─────────────────────────────────────────────────

export async function obtenerSesionPorId(id: string) {
  return prisma.sesion.findUnique({
    where: { id },
    select: {
      id:              true,
      claseId:         true,
      fecha:           true,
      temas:           true,
      notas:           true,
      registradaPorId: true,
      createdAt:       true,
      _count: {
        select: {
          asistencias: true,
        },
      },
    },
  });
}

// ── Obtener sesión con clase y edición (para la vista de asistencia) ──────────

export type SesionConClase = NonNullable<Awaited<ReturnType<typeof obtenerSesionConClase>>>;

export async function obtenerSesionConClase(id: string) {
  return prisma.sesion.findUnique({
    where: { id },
    select: {
      id:    true,
      fecha: true,
      temas: true,
      notas: true,
      clase: {
        select: {
          id:           true,
          nombre:       true,
          investigador: true,
          edicionId:    true,
          edicion: {
            select: {
              id:     true,
              nombre: true,
              anio:   true,
              activa: true,
            },
          },
        },
      },
    },
  });
}

// ── Crear una sesión ──────────────────────────────────────────────────────────

export async function crearSesion(data: CrearSesionInput, registradaPorId?: string) {
  return prisma.sesion.create({
    data: {
      claseId:         data.claseId,
      // El schema ya normalizó la fecha a medianoche UTC del día de calendario.
      fecha:           data.fecha,
      temas:           data.temas  ?? null,
      notas:           data.notas  ?? null,
      registradaPorId: registradaPorId ?? null,
    },
  });
}

// ── Actualizar fecha, temas y notas de una sesión ─────────────────────────────

export async function actualizarSesion(id: string, data: ActualizarSesionInput) {
  return prisma.sesion.update({
    where: { id },
    data: {
      ...(data.fecha !== undefined && { fecha: data.fecha }),
      ...(data.temas !== undefined && { temas: data.temas }),
      ...(data.notas !== undefined && { notas: data.notas }),
    },
  });
}

// ── Rango de fechas de la edición a la que pertenece una clase / sesión ───────

/** Datos mínimos de la edición para validar que una sesión caiga dentro de ella. */
export type RangoEdicion = {
  edicionId:   string;
  nombre:      string;
  anio:        number;
  fechaInicio: Date;
  fechaFin:    Date;
};

/**
 * Rango de una edición por su id. Hace falta al crear una clase: la clase aún
 * no existe, así que no se puede llegar a la edición a través de ella.
 */
export async function obtenerRangoEdicion(
  edicionId: string,
): Promise<RangoEdicion | null> {
  const edicion = await prisma.edicion.findUnique({
    where:  { id: edicionId },
    select: { id: true, nombre: true, anio: true, fechaInicio: true, fechaFin: true },
  });

  if (!edicion) return null;

  const { id, ...resto } = edicion;
  return { edicionId: id, ...resto };
}

export async function obtenerRangoEdicionDeClase(
  claseId: string,
): Promise<RangoEdicion | null> {
  const clase = await prisma.clase.findUnique({
    where:  { id: claseId },
    select: {
      edicion: {
        select: { id: true, nombre: true, anio: true, fechaInicio: true, fechaFin: true },
      },
    },
  });

  if (!clase) return null;

  const { id, ...resto } = clase.edicion;
  return { edicionId: id, ...resto };
}

export async function obtenerRangoEdicionDeSesion(
  sesionId: string,
): Promise<RangoEdicion | null> {
  const sesion = await prisma.sesion.findUnique({
    where:  { id: sesionId },
    select: {
      clase: {
        select: {
          edicion: {
            select: { id: true, nombre: true, anio: true, fechaInicio: true, fechaFin: true },
          },
        },
      },
    },
  });

  if (!sesion) return null;

  const { id, ...resto } = sesion.clase.edicion;
  return { edicionId: id, ...resto };
}

// ── Eliminar una sesión (solo si no tiene asistencias) ────────────────────────

export async function eliminarSesion(id: string) {
  const conteo = await prisma.asistencia.count({
    where: { sesionId: id },
  });

  if (conteo > 0) {
    throw new SesionConAsistenciasError(
      `No se puede eliminar la sesión porque tiene ${conteo} asistencia(s) registrada(s). ` +
        "Si la sesión se capturó por error, desmarca primero a esos participantes en la lista de asistencia.",
    );
  }

  return prisma.sesion.delete({ where: { id } });
}

// ── Errores personalizados ────────────────────────────────────────────────────

export class ClaseConAsistenciasError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ClaseConAsistenciasError";
  }
}

/** La clase todavía tiene sesiones en el calendario, aunque nadie haya pasado lista. */
export class ClaseConSesionesError extends Error {
  readonly sesiones: number;

  constructor(message: string, sesiones: number) {
    super(message);
    this.name = "ClaseConSesionesError";
    this.sesiones = sesiones;
  }
}

export class SesionConAsistenciasError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SesionConAsistenciasError";
  }
}

/** La clase tiene más de una sesión: no se puede adivinar a cuál cambiarle la fecha. */
export class VariasSesionesError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VariasSesionesError";
  }
}
