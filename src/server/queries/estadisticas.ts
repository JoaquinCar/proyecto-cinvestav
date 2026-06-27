import { prisma } from "@/server/db";

export type MetricasEdicion = {
  totalParticipantes: number;
  totalSesiones: number;
  promedioAsistencia: number;
  totalConstancias: number;
  porEscuela: { escuela: string; cantidad: number }[];
  porGrado: { grado: string; cantidad: number }[];
  porNivel: { escuela: string; cantidad: number }[];
  porCiudad: { escuela: string; cantidad: number }[];
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
          participante: {
            select: {
              escuela: true,
              grado: true,
              edad: true,
              genero: true,
              nivel: true,
              ciudad: true,
            },
          },
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
  const nivelCounts = new Map<string, number>();
  const ciudadCounts = new Map<string, number>();
  for (const i of inscripciones) {
    const e = i.participante.escuela;
    const g = i.participante.grado;
    escuelaCounts.set(e, (escuelaCounts.get(e) ?? 0) + 1);
    gradoCounts.set(g, (gradoCounts.get(g) ?? 0) + 1);
    const n = NIVEL_LABEL[i.participante.nivel ?? ""] ?? "Sin especificar";
    nivelCounts.set(n, (nivelCounts.get(n) ?? 0) + 1);
    const c = i.participante.ciudad?.trim() || "Sin especificar";
    ciudadCounts.set(c, (ciudadCounts.get(c) ?? 0) + 1);
  }

  const porEscuela = Array.from(escuelaCounts.entries())
    .map(([escuela, cantidad]) => ({ escuela, cantidad }))
    .sort((a, b) => b.cantidad - a.cantidad);

  const porGrado = Array.from(gradoCounts.entries())
    .map(([grado, cantidad]) => ({ grado, cantidad }))
    .sort((a, b) => a.grado.localeCompare(b.grado));

  const porNivel = Array.from(nivelCounts.entries())
    .map(([escuela, cantidad]) => ({ escuela, cantidad }))
    .sort((a, b) => (NIVEL_ORDEN[a.escuela] ?? 99) - (NIVEL_ORDEN[b.escuela] ?? 99));

  const porCiudad = Array.from(ciudadCounts.entries())
    .map(([escuela, cantidad]) => ({ escuela, cantidad }))
    .sort((a, b) => b.cantidad - a.cantidad);

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
    porNivel,
    porCiudad,
    clasesResumen,
    tendencia,
    porEdad,
    porGenero,
    rankingClases,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Análisis de ASISTENCIA agregada (totales por sesión, provenientes del Excel
// del organizador). No hay nombres individuales: son conteos por sesión.
// ─────────────────────────────────────────────────────────────────────────────

const NIVEL_LABEL: Record<string, string> = {
  PREESCOLAR: "Preescolar",
  PRIMARIA: "Primaria",
  SECUNDARIA: "Secundaria",
  MEDIA_SUPERIOR: "Media superior",
  SIN_ESCUELA: "Sin escuela",
};
const NIVEL_ORDEN: Record<string, number> = {
  Preescolar: 0,
  Primaria: 1,
  Secundaria: 2,
  "Media superior": 3,
  "Sin escuela": 4,
};

export type MetricasAsistencia = {
  sesionesConDatos: number;
  totalSesiones: number;
  totalEventos: number;
  promedioPorSesion: number;
  picoSesion: number;
  totalNinas: number;
  totalNinos: number;
  totalMamas: number;
  totalPapas: number;
  porSesion: {
    etiqueta: string;
    tema: string;
    ninas: number;
    ninos: number;
    total: number;
  }[];
  tendencia: { fecha: string; etiqueta: string; presentes: number }[];
  porEdad: { edad: number; cantidad: number }[];
  porNivel: { escuela: string; cantidad: number }[];
  porGenero: { genero: "FEMENINO" | "MASCULINO"; cantidad: number }[];
};

export async function obtenerMetricasAsistencia(
  edicionId: string,
): Promise<MetricasAsistencia> {
  const sesiones = await prisma.sesion.findMany({
    where: { clase: { edicionId } },
    orderBy: { fecha: "asc" },
    select: {
      fecha: true,
      temas: true,
      clase: { select: { nombre: true } },
      resumen: true,
    },
  });

  const totalSesiones = sesiones.length;
  const conResumen = sesiones.filter((s) => s.resumen);

  const porSesion = conResumen.map((s) => {
    const r = s.resumen!;
    return {
      etiqueta: new Date(s.fecha).toLocaleDateString("es-MX", {
        day: "numeric",
        month: "short",
      }),
      tema: s.temas ?? s.clase.nombre,
      ninas: r.ninas,
      ninos: r.ninos,
      total: r.total,
    };
  });

  const totalNinas = conResumen.reduce((a, s) => a + s.resumen!.ninas, 0);
  const totalNinos = conResumen.reduce((a, s) => a + s.resumen!.ninos, 0);
  const totalMamas = conResumen.reduce((a, s) => a + s.resumen!.mamas, 0);
  const totalPapas = conResumen.reduce((a, s) => a + s.resumen!.papas, 0);
  const totalEventos = conResumen.reduce((a, s) => a + s.resumen!.total, 0);
  const picoSesion = conResumen.length
    ? Math.max(...conResumen.map((s) => s.resumen!.total))
    : 0;
  const promedioPorSesion = conResumen.length
    ? Math.round(totalEventos / conResumen.length)
    : 0;

  const tendencia = conResumen.map((s) => ({
    fecha: new Date(s.fecha).toISOString().slice(0, 10),
    etiqueta: new Date(s.fecha).toLocaleDateString("es-MX", {
      day: "numeric",
      month: "short",
    }),
    presentes: s.resumen!.total,
  }));

  // Asistencia por edad (suma de eventos por edad sobre todas las sesiones)
  const edadMap = new Map<number, number>();
  for (const s of conResumen) {
    const porEdad = (s.resumen!.porEdad ?? {}) as Record<string, number>;
    for (const [edad, cant] of Object.entries(porEdad)) {
      const e = Number(edad);
      edadMap.set(e, (edadMap.get(e) ?? 0) + Number(cant));
    }
  }
  const porEdad = Array.from(edadMap.entries())
    .map(([edad, cantidad]) => ({ edad, cantidad }))
    .sort((a, b) => a.edad - b.edad);

  // Asistencia por nivel escolar (suma de eventos)
  const nivelSum = {
    Preescolar: 0,
    Primaria: 0,
    Secundaria: 0,
    "Media superior": 0,
  };
  for (const s of conResumen) {
    nivelSum.Preescolar += s.resumen!.preescolar;
    nivelSum.Primaria += s.resumen!.primaria;
    nivelSum.Secundaria += s.resumen!.secundaria;
    nivelSum["Media superior"] += s.resumen!.mediaSuperior;
  }
  const porNivel = Object.entries(nivelSum)
    .filter(([, c]) => c > 0)
    .map(([escuela, cantidad]) => ({ escuela, cantidad }));

  const porGenero = (
    [
      ["FEMENINO", totalNinas],
      ["MASCULINO", totalNinos],
    ] as ["FEMENINO" | "MASCULINO", number][]
  )
    .filter(([, c]) => c > 0)
    .map(([genero, cantidad]) => ({ genero, cantidad }));

  return {
    sesionesConDatos: conResumen.length,
    totalSesiones,
    totalEventos,
    promedioPorSesion,
    picoSesion,
    totalNinas,
    totalNinos,
    totalMamas,
    totalPapas,
    porSesion,
    tendencia,
    porEdad,
    porNivel,
    porGenero,
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
