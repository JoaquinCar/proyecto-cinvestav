import { prisma } from "@/server/db";
import type { ParticipanteInput } from "@/lib/schemas/participante.schema";

// ── Tipos de retorno ──────────────────────────────────────────────────────────

export type ParticipanteConInscripciones = Awaited<
  ReturnType<typeof buscarParticipantes>
>[number];

export type ParticipanteHistorial = Awaited<
  ReturnType<typeof obtenerHistorialParticipante>
>;

// ── Buscar participantes (búsqueda por nombre / apellidos) ────────────────────

export async function buscarParticipantes(q?: string, edicionId?: string) {
  const where = q?.trim()
    ? {
        OR: [
          { nombre:    { contains: q.trim(), mode: "insensitive" as const } },
          { apellidos: { contains: q.trim(), mode: "insensitive" as const } },
        ],
      }
    : {};

  return prisma.participante.findMany({
    where,
    orderBy: [{ apellidos: "asc" }, { nombre: "asc" }],
    take: 50,
    include: {
      inscripciones: {
        include: {
          edicion: {
            select: { id: true, anio: true, nombre: true, activa: true },
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });
}

// ── Crear participante ────────────────────────────────────────────────────────

export async function crearParticipante(data: ParticipanteInput) {
  return prisma.participante.create({
    data: {
      nombre:    data.nombre,
      apellidos: data.apellidos,
      edad:      data.edad,
      escuela:   data.escuela,
      grado:     data.grado,
    },
  });
}

// ── Historial completo de un participante ─────────────────────────────────────

export async function obtenerHistorialParticipante(id: string) {
  return prisma.participante.findUnique({
    where: { id },
    include: {
      inscripciones: {
        include: {
          edicion: {
            select: {
              id:          true,
              anio:        true,
              nombre:      true,
              activa:      true,
              fechaInicio: true,
              fechaFin:    true,
            },
          },
          asistencias: {
            include: {
              sesion: {
                select: {
                  id:     true,
                  fecha:  true,
                  temas:  true,
                  clase: {
                    select: { id: true, nombre: true },
                  },
                },
              },
            },
            orderBy: { createdAt: "asc" },
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });
}

// ── Buscar participantes similares (detección de recurrentes) ─────────────────
// Útil para que el frontend advierta al coordinador antes de registrar un posible duplicado.

export async function buscarParticipantesSimilares(
  nombre: string,
  apellidos: string,
) {
  // Busca coincidencias parciales en nombre O en apellidos para detectar al
  // mismo niño registrado en ediciones anteriores bajo una grafía ligeramente distinta.
  const palabrasNombre    = nombre.trim().split(/\s+/).filter(Boolean);
  const palabrasApellidos = apellidos.trim().split(/\s+/).filter(Boolean);

  // Construir condiciones OR: cualquier palabra del nombre coincide en nombre/apellidos
  const condiciones = [
    ...palabrasNombre.map((p) => ({
      nombre: { contains: p, mode: "insensitive" as const },
    })),
    ...palabrasApellidos.map((p) => ({
      apellidos: { contains: p, mode: "insensitive" as const },
    })),
  ];

  if (condiciones.length === 0) return [];

  return prisma.participante.findMany({
    where: { OR: condiciones },
    orderBy: [{ apellidos: "asc" }, { nombre: "asc" }],
    take: 10,
    include: {
      inscripciones: {
        include: {
          edicion: {
            select: { id: true, anio: true, nombre: true, activa: true },
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });
}

// ── Inscribir participante a una edición ──────────────────────────────────────

export async function inscribirParticipante(
  participanteId: string,
  edicionId: string,
) {
  // Verificar que la edición existe y está activa
  const edicion = await prisma.edicion.findUnique({
    where: { id: edicionId },
    select: { id: true, activa: true, nombre: true },
  });

  if (!edicion) {
    throw new Error("EDICION_NO_ENCONTRADA");
  }

  if (!edicion.activa) {
    throw new Error("EDICION_NO_ACTIVA");
  }

  // Verificar que el participante existe
  const participante = await prisma.participante.findUnique({
    where: { id: participanteId },
    select: { id: true },
  });

  if (!participante) {
    throw new Error("PARTICIPANTE_NO_ENCONTRADO");
  }

  // Crear inscripción (falla con P2002 si ya existe el unique[participanteId, edicionId])
  return prisma.inscripcion.create({
    data: { participanteId, edicionId },
    include: {
      participante: {
        select: { id: true, nombre: true, apellidos: true },
      },
      edicion: {
        select: { id: true, anio: true, nombre: true },
      },
    },
  });
}

// ── Desinscribir participante ─────────────────────────────────────────────────

export async function desinscribirParticipante(inscripcionId: string) {
  // Verificar que la inscripción existe antes de borrar
  const inscripcion = await prisma.inscripcion.findUnique({
    where: { id: inscripcionId },
    select: { id: true },
  });

  if (!inscripcion) {
    throw new Error("INSCRIPCION_NO_ENCONTRADA");
  }

  return prisma.inscripcion.delete({
    where: { id: inscripcionId },
  });
}
