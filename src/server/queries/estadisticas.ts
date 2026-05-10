import { prisma } from "@/server/db";

export type MetricasEdicion = {
  totalParticipantes: number;
  totalSesiones: number;
  promedioAsistencia: number;
  totalConstancias: number;
  porEscuela: { escuela: string; cantidad: number }[];
  porGrado: { grado: string; cantidad: number }[];
  clasesResumen: { nombre: string; sesiones: number; asistenciaPromedio: number }[];
};

export async function obtenerMetricasEdicion(
  edicionId: string,
): Promise<MetricasEdicion> {
  const [totalParticipantes, totalConstancias, inscripciones, clases] =
    await Promise.all([
      prisma.inscripcion.count({ where: { edicionId } }),
      prisma.inscripcion.count({ where: { edicionId, constanciaGenerada: true } }),
      prisma.inscripcion.findMany({
        where: { edicionId },
        select: {
          participante: { select: { escuela: true, grado: true } },
          asistencias: { where: { presente: true }, select: { id: true } },
        },
      }),
      prisma.clase.findMany({
        where: { edicionId },
        select: {
          nombre: true,
          sesiones: {
            select: {
              id: true,
              asistencias: { where: { presente: true }, select: { id: true } },
            },
          },
        },
      }),
    ]);

  const totalSesiones = clases.reduce((acc, c) => acc + c.sesiones.length, 0);
  const totalAsistencias = inscripciones.reduce(
    (acc, i) => acc + i.asistencias.length,
    0,
  );
  const promedioAsistencia =
    totalParticipantes > 0 && totalSesiones > 0
      ? Math.round(
          (totalAsistencias / (totalParticipantes * totalSesiones)) * 100,
        )
      : 0;

  const escuelaCounts = new Map<string, number>();
  const gradoCounts = new Map<string, number>();
  for (const i of inscripciones) {
    const e = i.participante.escuela;
    const g = i.participante.grado;
    escuelaCounts.set(e, (escuelaCounts.get(e) ?? 0) + 1);
    gradoCounts.set(g, (gradoCounts.get(g) ?? 0) + 1);
  }

  const porEscuela = Array.from(escuelaCounts.entries())
    .map(([escuela, cantidad]) => ({ escuela, cantidad }))
    .sort((a, b) => b.cantidad - a.cantidad);

  const porGrado = Array.from(gradoCounts.entries())
    .map(([grado, cantidad]) => ({ grado, cantidad }))
    .sort((a, b) => a.grado.localeCompare(b.grado));

  const clasesResumen = clases.map((c) => {
    const totalAs = c.sesiones.reduce((acc, s) => acc + s.asistencias.length, 0);
    const asistenciaPromedio =
      c.sesiones.length > 0 && totalParticipantes > 0
        ? Math.round(
            (totalAs / (c.sesiones.length * totalParticipantes)) * 100,
          )
        : 0;
    return { nombre: c.nombre, sesiones: c.sesiones.length, asistenciaPromedio };
  });

  return {
    totalParticipantes,
    totalSesiones,
    promedioAsistencia,
    totalConstancias,
    porEscuela,
    porGrado,
    clasesResumen,
  };
}

export async function obtenerDatosExcel(edicionId: string) {
  const inscripciones = await prisma.inscripcion.findMany({
    where: { edicionId },
    orderBy: [
      { participante: { apellidos: "asc" } },
      { participante: { nombre: "asc" } },
    ],
    select: {
      participante: {
        select: {
          nombre: true,
          apellidos: true,
          escuela: true,
          grado: true,
          edad: true,
        },
      },
      constanciaGenerada: true,
      asistencias: { where: { presente: true }, select: { id: true } },
    },
  });

  return inscripciones.map((i) => ({
    Nombre: i.participante.nombre,
    Apellidos: i.participante.apellidos,
    Escuela: i.participante.escuela,
    Grado: i.participante.grado,
    Edad: i.participante.edad,
    Asistencias: i.asistencias.length,
    Constancia: i.constanciaGenerada ? "Sí" : "No",
  }));
}
