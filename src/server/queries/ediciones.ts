import { prisma } from "@/server/db";
import type { CrearEdicionInput, EditarEdicionInput } from "@/lib/schemas/edicion.schema";

// ── Listar todas las ediciones ────────────────────────────────────────────────

export async function listarEdiciones() {
  return prisma.edicion.findMany({
    orderBy: { anio: "desc" },
    select: {
      id: true,
      anio: true,
      nombre: true,
      fechaInicio: true,
      fechaFin: true,
      minAsistencias: true,
      porcentajeMinimo: true,
      asistenciaGlobal: true,
      activa: true,
      createdAt: true,
      _count: {
        select: {
          inscripciones: true,
          clases: true,
        },
      },
    },
  });
}

// ── Obtener una edición por ID con conteos ────────────────────────────────────

export async function obtenerEdicionPorId(id: string) {
  return prisma.edicion.findUnique({
    where: { id },
    select: {
      id: true,
      anio: true,
      nombre: true,
      fechaInicio: true,
      fechaFin: true,
      minAsistencias: true,
      porcentajeMinimo: true,
      asistenciaGlobal: true,
      activa: true,
      createdAt: true,
      _count: {
        select: {
          inscripciones: true,
          clases: true,
        },
      },
    },
  });
}

// ── Crear nueva edición ───────────────────────────────────────────────────────

export async function crearEdicion(data: CrearEdicionInput) {
  return prisma.edicion.create({
    data: {
      anio: data.anio,
      nombre: data.nombre,
      fechaInicio: new Date(data.fechaInicio),
      fechaFin: new Date(data.fechaFin),
      minAsistencias: data.minAsistencias,
      porcentajeMinimo: data.porcentajeMinimo,
      asistenciaGlobal: data.asistenciaGlobal,
    },
  });
}

// ── Editar una edición existente ──────────────────────────────────────────────

export async function editarEdicion(id: string, data: EditarEdicionInput) {
  return prisma.edicion.update({
    where: { id },
    data: {
      ...(data.anio !== undefined && { anio: data.anio }),
      ...(data.nombre !== undefined && { nombre: data.nombre }),
      ...(data.fechaInicio !== undefined && {
        fechaInicio: new Date(data.fechaInicio),
      }),
      ...(data.fechaFin !== undefined && {
        fechaFin: new Date(data.fechaFin),
      }),
      ...(data.minAsistencias !== undefined && {
        minAsistencias: data.minAsistencias,
      }),
      ...(data.porcentajeMinimo !== undefined && {
        porcentajeMinimo: data.porcentajeMinimo,
      }),
      ...(data.asistenciaGlobal !== undefined && {
        asistenciaGlobal: data.asistenciaGlobal,
      }),
    },
  });
}

// ── Eliminar edición (solo si no tiene inscripciones) ────────────────────────

export async function eliminarEdicion(id: string) {
  // Verificar que no haya inscripciones antes de eliminar
  const conteo = await prisma.inscripcion.count({
    where: { edicionId: id },
  });

  if (conteo > 0) {
    throw new EdicionConInscripcionesError(
      `No se puede eliminar la edición porque tiene ${conteo} inscripción(es) registrada(s)`
    );
  }

  return prisma.edicion.delete({ where: { id } });
}

// ── Activar edición (transacción: desactivar todas, luego activar la nueva) ──

export async function activarEdicion(id: string) {
  return prisma.$transaction(async (tx) => {
    // 1. Desactivar todas las ediciones
    await tx.edicion.updateMany({
      data: { activa: false },
    });

    // 2. Activar la edición solicitada
    return tx.edicion.update({
      where: { id },
      data: { activa: true },
    });
  });
}

// ── Verificar existencia de edición ──────────────────────────────────────────

export async function existeEdicion(id: string): Promise<boolean> {
  const edicion = await prisma.edicion.findUnique({
    where: { id },
    select: { id: true },
  });
  return edicion !== null;
}

// ── Error personalizado ───────────────────────────────────────────────────────

export class EdicionConInscripcionesError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EdicionConInscripcionesError";
  }
}
