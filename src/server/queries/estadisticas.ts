import { prisma } from "@/server/db";

export type MetricasEdicion = {
  totalParticipantes: number;
  totalSesiones: number;
  promedioAsistencia: number;
  totalConstancias: number;
  porEscuela: { escuela: string; cantidad: number }[];
  porGrado: { grado: string; cantidad: number }[];
  clasesResumen: { nombre: string; sesiones: number; asistenciaPromedio: number }[];
  // ── nuevos agregados ──
  tendencia: { fecha: string; etiqueta: string; presentes: number }[];
  porEdad: { edad: number; cantidad: number }[];
  porGenero: { genero: "FEMENINO" | "MASCULINO" | "Sin especificar"; cantidad: number }[];
  rankingClases: { nombre: string; asistentes: number }[];
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
          participante: { select: { escuela: true, grado: true, edad: true, genero: true } },
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
              fecha: true,
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

  // ── Tendencia: presentes por fecha (programa a lo largo del tiempo) ──────────
  const fechaMap = new Map<string, number>();
  for (const c of clases) {
    for (const s of c.sesiones) {
      const key = new Date(s.fecha).toISOString().slice(0, 10);
      fechaMap.set(key, (fechaMap.get(key) ?? 0) + s.asistencias.length);
    }
  }
  const tendencia = Array.from(fechaMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([fecha, presentes]) => ({
      fecha,
      etiqueta: new Date(fecha + "T00:00:00").toLocaleDateString("es-MX", {
        day: "numeric",
        month: "short",
      }),
      presentes,
    }));

  // ── Distribución por edad ─────────────────────────────────────────────────
  const edadCounts = new Map<number, number>();
  for (const i of inscripciones) {
    const e = i.participante.edad;
    edadCounts.set(e, (edadCounts.get(e) ?? 0) + 1);
  }
  const porEdad = Array.from(edadCounts.entries())
    .map(([edad, cantidad]) => ({ edad, cantidad }))
    .sort((a, b) => a.edad - b.edad);

  // ── Distribución por género ───────────────────────────────────────────────
  const generoCounts = { FEMENINO: 0, MASCULINO: 0, "Sin especificar": 0 };
  for (const i of inscripciones) {
    const g = i.participante.genero;
    if (g === "FEMENINO") generoCounts.FEMENINO += 1;
    else if (g === "MASCULINO") generoCounts.MASCULINO += 1;
    else generoCounts["Sin especificar"] += 1;
  }
  const porGenero = (
    Object.entries(generoCounts) as [
      "FEMENINO" | "MASCULINO" | "Sin especificar",
      number,
    ][]
  )
    .filter(([, cantidad]) => cantidad > 0)
    .map(([genero, cantidad]) => ({ genero, cantidad }));

  // ── Ranking de clases por asistentes totales ──────────────────────────────
  const rankingClases = clases
    .map((c) => ({
      nombre: c.nombre,
      asistentes: c.sesiones.reduce((acc, s) => acc + s.asistencias.length, 0),
    }))
    .sort((a, b) => b.asistentes - a.asistentes);

  return {
    totalParticipantes,
    totalSesiones,
    promedioAsistencia,
    totalConstancias,
    porEscuela,
    porGrado,
    clasesResumen,
    tendencia,
    porEdad,
    porGenero,
    rankingClases,
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
