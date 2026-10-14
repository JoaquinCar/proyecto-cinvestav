import { prisma } from "@/server/db";
import { ASISTENCIAS_QUE_CUENTAN, CLASES_QUE_CUENTAN } from "@/lib/tipos-sesion";

export type HistoricoEdicion = {
  anio: number;
  nombre: string;
  totalParticipantes: number;
  /** Solo las sesiones que cuentan, igual que en el tablero de cada edición. */
  totalSesiones: number;
  /** Mismo recorte: si no, la gráfica comparativa contradecía al tablero. */
  promedioAsistencia: number;
};

export type EscuelaRecurrente = {
  escuela: string;
  ediciones: number;
  totalParticipantes: number;
};

export type ParticipanteRecurrente = {
  id: string;
  nombre: string;
  apellidos: string;
  escuela: string;
  ediciones: number;
};

export async function obtenerHistoricoEdiciones(): Promise<HistoricoEdicion[]> {
  const ediciones = await prisma.edicion.findMany({
    orderBy: { anio: "asc" },
    include: {
      inscripciones: {
        include: {
          asistencias: { where: ASISTENCIAS_QUE_CUENTAN, select: { id: true } },
        },
      },
      // El comparativo entre ediciones es una estadística más: cuenta lo mismo
      // que el tablero de cada edición. Si aquí entraran las lecturas y los
      // eventos, la gráfica «Sesiones por edición» diría 22 donde el tablero
      // dice 12.
      clases: {
        where: CLASES_QUE_CUENTAN,
        include: { sesiones: { select: { id: true } } },
      },
    },
  });

  return ediciones.map((e) => {
    const totalParticipantes = e.inscripciones.length;
    const totalSesiones = e.clases.flatMap((c) => c.sesiones).length;
    const totalAs = e.inscripciones.reduce(
      (acc, i) => acc + i.asistencias.length,
      0,
    );
    const promedioAsistencia =
      totalParticipantes > 0 && totalSesiones > 0
        ? Math.round((totalAs / (totalParticipantes * totalSesiones)) * 100)
        : 0;
    return { anio: e.anio, nombre: e.nombre, totalParticipantes, totalSesiones, promedioAsistencia };
  });
}

export async function obtenerEscuelasRecurrentes(limit = 20): Promise<EscuelaRecurrente[]> {
  const inscripciones = await prisma.inscripcion.findMany({
    select: {
      edicionId: true,
      participante: { select: { escuela: true } },
    },
  });

  const escuelaEdiciones = new Map<string, Set<string>>();
  const escuelaTotales = new Map<string, number>();

  for (const i of inscripciones) {
    const e = i.participante.escuela;
    if (!escuelaEdiciones.has(e)) {
      escuelaEdiciones.set(e, new Set());
      escuelaTotales.set(e, 0);
    }
    escuelaEdiciones.get(e)!.add(i.edicionId);
    escuelaTotales.set(e, (escuelaTotales.get(e) ?? 0) + 1);
  }

  return Array.from(escuelaEdiciones.entries())
    .map(([escuela, edicionSet]) => ({
      escuela,
      ediciones: edicionSet.size,
      totalParticipantes: escuelaTotales.get(escuela) ?? 0,
    }))
    .sort(
      (a, b) =>
        b.ediciones - a.ediciones || b.totalParticipantes - a.totalParticipantes,
    )
    .slice(0, limit);
}

export async function obtenerParticipantesRecurrentes(
  limit = 20,
): Promise<ParticipanteRecurrente[]> {
  const participantes = await prisma.participante.findMany({
    where: { inscripciones: { some: {} } },
    include: { inscripciones: { select: { id: true } } },
  });

  return participantes
    .map((p) => ({
      id: p.id,
      nombre: p.nombre,
      apellidos: p.apellidos,
      escuela: p.escuela,
      ediciones: p.inscripciones.length,
    }))
    .filter((p) => p.ediciones > 1)
    .sort((a, b) => b.ediciones - a.ediciones)
    .slice(0, limit);
}
