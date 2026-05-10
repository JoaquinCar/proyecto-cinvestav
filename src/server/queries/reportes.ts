import { prisma } from "@/server/db";
import type { DatosReporteClase } from "@/lib/pdf/reporte-clase";

export async function obtenerDatosReporteClase(
  claseId: string,
): Promise<DatosReporteClase | null> {
  const clase = await prisma.clase.findUnique({
    where: { id: claseId },
    include: {
      edicion: { select: { nombre: true, anio: true, id: true } },
      sesiones: {
        orderBy: { fecha: "asc" },
        include: {
          asistencias: { where: { presente: true }, select: { inscripcionId: true } },
        },
      },
    },
  });

  if (!clase) return null;

  const inscripciones = await prisma.inscripcion.findMany({
    where: { edicionId: clase.edicionId },
    orderBy: [
      { participante: { apellidos: "asc" } },
      { participante: { nombre: "asc" } },
    ],
    include: {
      participante: { select: { nombre: true, apellidos: true, escuela: true } },
      asistencias: {
        where: {
          sesionId: { in: clase.sesiones.map((s) => s.id) },
          presente: true,
        },
        select: { id: true },
      },
    },
  });

  const totalParticipantes = inscripciones.length;

  const sesionesData = clase.sesiones.map((s) => ({
    fecha: new Date(s.fecha).toLocaleDateString("es-MX", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }),
    temas: s.temas,
    asistentes: s.asistencias.length,
    total: totalParticipantes,
  }));

  const participantesData = inscripciones.map((i) => ({
    nombre: i.participante.nombre,
    apellidos: i.participante.apellidos,
    escuela: i.participante.escuela,
    asistenciasEnClase: i.asistencias.length,
  }));

  const totalAs = clase.sesiones.reduce((acc, s) => acc + s.asistencias.length, 0);
  const promedioAsistencia =
    clase.sesiones.length > 0 && totalParticipantes > 0
      ? Math.round((totalAs / (clase.sesiones.length * totalParticipantes)) * 100)
      : 0;

  return {
    clase: { nombre: clase.nombre, investigador: clase.investigador },
    edicion: { nombre: clase.edicion.nombre, anio: clase.edicion.anio },
    sesiones: sesionesData,
    participantes: participantesData,
    totalParticipantes,
    promedioAsistencia,
  };
}
