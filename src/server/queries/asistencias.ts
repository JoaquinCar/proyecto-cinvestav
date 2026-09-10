import { prisma } from "@/server/db";
import type { MarcarAsistenciaInput } from "@/lib/schemas/asistencia.schema";
import { assertEdicionAbierta } from "@/server/queries/edicion-cerrada";

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

// ── Guarda de integridad entre ediciones ─────────────────────────────────────
// Una Asistencia liga una Inscripcion (que pertenece a una edición) con una
// Sesion (que cuelga de una Clase, que también pertenece a una edición). Nada
// en el esquema impide que ambas sean de ediciones distintas: si eso ocurre, el
// registro contamina las estadísticas y las constancias de las DOS ediciones.
// Se valida antes de escribir.

export class AsistenciaFueraDeEdicionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AsistenciaFueraDeEdicionError";
  }
}

/**
 * Valida la coherencia de edición y devuelve las ediciones tocadas por el lote,
 * para poder comprobar después que ninguna esté cerrada.
 */
async function validarMismaEdicion(
  items: Array<{ inscripcionId: string; sesionId: string }>,
): Promise<Set<string>> {
  const inscripcionIds = [...new Set(items.map((i) => i.inscripcionId))];
  const sesionIds      = [...new Set(items.map((i) => i.sesionId))];

  const [inscripciones, sesiones] = await Promise.all([
    prisma.inscripcion.findMany({
      where:  { id: { in: inscripcionIds } },
      select: { id: true, edicionId: true },
    }),
    prisma.sesion.findMany({
      where:  { id: { in: sesionIds } },
      select: { id: true, clase: { select: { edicionId: true } } },
    }),
  ]);

  const edicionDeInscripcion = new Map(
    inscripciones.map((i) => [i.id, i.edicionId]),
  );
  const edicionDeSesion = new Map(
    sesiones.map((s) => [s.id, s.clase.edicionId]),
  );

  const edicionesTocadas = new Set<string>();

  for (const item of items) {
    const edicionInscripcion = edicionDeInscripcion.get(item.inscripcionId);
    const edicionSesion      = edicionDeSesion.get(item.sesionId);

    if (!edicionInscripcion || !edicionSesion) {
      throw new AsistenciaFueraDeEdicionError(
        "La inscripción o la sesión no existen",
      );
    }

    if (edicionInscripcion !== edicionSesion) {
      throw new AsistenciaFueraDeEdicionError(
        "La inscripción no pertenece a la edición de la sesión",
      );
    }

    edicionesTocadas.add(edicionSesion);
  }

  return edicionesTocadas;
}

// Una edición cerrada no acepta más asistencias: se comprueba ANTES de abrir la
// transacción para que un lote sobre una edición congelada no escriba nada.
async function validarEdicionesAbiertas(
  items: Array<{ inscripcionId: string; sesionId: string }>,
): Promise<void> {
  const ediciones = await validarMismaEdicion(items);
  for (const edicionId of ediciones) {
    await assertEdicionAbierta(edicionId);
  }
}

// ── Upsert de una asistencia individual ──────────────────────────────────────

export async function upsertAsistencia(data: MarcarAsistenciaInput) {
  await validarEdicionesAbiertas([data]);

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
  await validarEdicionesAbiertas(items);

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
