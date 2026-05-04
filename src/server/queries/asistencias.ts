import { prisma } from "@/server/db";
import type { MarcarAsistenciaInput } from "@/lib/schemas/asistencia.schema";

// ── Tipos de retorno ──────────────────────────────────────────────────────────

export type AsistenciaEnSesion = {
  inscripcion: {
    id:          string;
    participante: {
      nombre:    string;
      apellidos: string;
      escuela:   string;
    };
  };
  presente: boolean | null;
};

export type ResumenAsistencia = {
  total:    number;
  presentes: number;
  ausentes:  number;
};

// ── Obtener asistencias de una sesión ─────────────────────────────────────────
// Devuelve todas las inscripciones de la edición a la que pertenece esta sesión,
// con su estado de asistencia (null = sin registro aún = ausente por defecto).

export async function obtenerAsistenciasDeSesion(
  sesionId: string,
): Promise<AsistenciaEnSesion[]> {
  // 1. Obtener la sesión con su clase y edición
  const sesion = await prisma.sesion.findUnique({
    where: { id: sesionId },
    select: {
      id:    true,
      clase: {
        select: {
          edicionId: true,
        },
      },
    },
  });

  if (!sesion) return [];

  const { edicionId } = sesion.clase;

  // 2. Obtener todas las inscripciones de esa edición, con el participante
  const inscripciones = await prisma.inscripcion.findMany({
    where: { edicionId },
    orderBy: [
      { participante: { apellidos: "asc" } },
      { participante: { nombre:    "asc" } },
    ],
    select: {
      id:          true,
      participante: {
        select: {
          nombre:    true,
          apellidos: true,
          escuela:   true,
        },
      },
    },
  });

  if (inscripciones.length === 0) return [];

  // 3. Obtener los registros de asistencia existentes para esta sesión
  const asistenciasExistentes = await prisma.asistencia.findMany({
    where: { sesionId },
    select: {
      inscripcionId: true,
      presente:      true,
    },
  });

  // 4. Indexar por inscripcionId para lookup O(1)
  const mapaPresente = new Map<string, boolean>(
    asistenciasExistentes.map((a) => [a.inscripcionId, a.presente]),
  );

  // 5. Combinar: null cuando no hay registro (ausente implícito)
  return inscripciones.map((insc) => ({
    inscripcion: {
      id:          insc.id,
      participante: insc.participante,
    },
    presente: mapaPresente.has(insc.id) ? (mapaPresente.get(insc.id) ?? null) : null,
  }));
}

// ── Upsert de una asistencia individual ──────────────────────────────────────

export async function upsertAsistencia(data: MarcarAsistenciaInput) {
  return prisma.asistencia.upsert({
    where: {
      inscripcionId_sesionId: {
        inscripcionId: data.inscripcionId,
        sesionId:      data.sesionId,
      },
    },
    update: {
      presente: data.presente,
    },
    create: {
      inscripcionId: data.inscripcionId,
      sesionId:      data.sesionId,
      presente:      data.presente,
    },
  });
}

// ── Batch upsert de múltiples asistencias (transacción) ──────────────────────

export async function batchUpsertAsistencias(
  items: Array<{ inscripcionId: string; sesionId: string; presente: boolean }>,
) {
  return prisma.$transaction(
    items.map((item) =>
      prisma.asistencia.upsert({
        where: {
          inscripcionId_sesionId: {
            inscripcionId: item.inscripcionId,
            sesionId:      item.sesionId,
          },
        },
        update: {
          presente: item.presente,
        },
        create: {
          inscripcionId: item.inscripcionId,
          sesionId:      item.sesionId,
          presente:      item.presente,
        },
      }),
    ),
  );
}

// ── Resumen de asistencia para una sesión ────────────────────────────────────

export async function obtenerResumenAsistencia(
  sesionId: string,
): Promise<ResumenAsistencia> {
  // Obtenemos el total de inscripciones de la edición y los presentes registrados
  const sesion = await prisma.sesion.findUnique({
    where: { id: sesionId },
    select: {
      clase: {
        select: {
          edicionId: true,
        },
      },
    },
  });

  if (!sesion) {
    return { total: 0, presentes: 0, ausentes: 0 };
  }

  const [total, presentes] = await Promise.all([
    prisma.inscripcion.count({
      where: { edicionId: sesion.clase.edicionId },
    }),
    prisma.asistencia.count({
      where: { sesionId, presente: true },
    }),
  ]);

  return {
    total,
    presentes,
    ausentes: total - presentes,
  };
}
