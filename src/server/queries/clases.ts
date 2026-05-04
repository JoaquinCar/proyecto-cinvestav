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
      _count: {
        select: {
          sesiones: true,
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

// ── Crear una clase ───────────────────────────────────────────────────────────

export async function crearClase(data: CrearClaseInput) {
  return prisma.clase.create({
    data: {
      edicionId:    data.edicionId,
      nombre:       data.nombre,
      investigador: data.investigador,
      descripcion:  data.descripcion ?? null,
    },
  });
}

// ── Editar una clase existente ────────────────────────────────────────────────

export async function editarClase(id: string, data: EditarClaseInput) {
  return prisma.clase.update({
    where: { id },
    data: {
      ...(data.nombre       !== undefined && { nombre:       data.nombre }),
      ...(data.investigador !== undefined && { investigador: data.investigador }),
      ...(data.descripcion  !== undefined && { descripcion:  data.descripcion }),
    },
  });
}

// ── Eliminar una clase (solo si no tiene sesiones con asistencias) ─────────────

export async function eliminarClase(id: string) {
  // Contar asistencias a través de sesiones de esta clase
  const asistencias = await prisma.asistencia.count({
    where: {
      sesion: { claseId: id },
    },
  });

  if (asistencias > 0) {
    throw new ClaseConAsistenciasError(
      `No se puede eliminar la clase porque tiene ${asistencias} asistencia(s) registrada(s)`
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

// ── Crear una sesión ──────────────────────────────────────────────────────────

export async function crearSesion(data: CrearSesionInput, registradaPorId?: string) {
  return prisma.sesion.create({
    data: {
      claseId:         data.claseId,
      fecha:           new Date(data.fecha),
      temas:           data.temas  ?? null,
      notas:           data.notas  ?? null,
      registradaPorId: registradaPorId ?? null,
    },
  });
}

// ── Actualizar temas y notas de una sesión ────────────────────────────────────

export async function actualizarSesion(id: string, data: ActualizarSesionInput) {
  return prisma.sesion.update({
    where: { id },
    data: {
      ...(data.temas !== undefined && { temas: data.temas }),
      ...(data.notas !== undefined && { notas: data.notas }),
    },
  });
}

// ── Eliminar una sesión (solo si no tiene asistencias) ────────────────────────

export async function eliminarSesion(id: string) {
  const conteo = await prisma.asistencia.count({
    where: { sesionId: id },
  });

  if (conteo > 0) {
    throw new SesionConAsistenciasError(
      `No se puede eliminar la sesión porque tiene ${conteo} asistencia(s) registrada(s)`
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

export class SesionConAsistenciasError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SesionConAsistenciasError";
  }
}
