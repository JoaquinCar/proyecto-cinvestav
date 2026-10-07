import { prisma } from "@/server/db";
import { formatearFecha, aISOFecha } from "@/lib/fechas";
import {
  TIPOS_SESION,
  cuentaParaConstancia,
  type TipoSesion,
} from "@/lib/tipos-sesion";
import type { Nivel } from "@/lib/importacion/texto";
import {
  asistenciaDeSesion,
  etiquetaNivel,
  NIVEL_LABEL,
  NIVEL_ORDEN,
  SELECCION_LISTA,
  type AsistenciaDeSesion,
} from "./asistencia-de-sesion";

// Orden lógico de los grados homologados para las gráficas.
function ordenGrado(g: string): number {
  if (g === "Preescolar") return 0;
  const m = g.match(/^(\d)°\s+(Primaria|Secundaria)/);
  if (m) {
    const n = parseInt(m[1], 10);
    return m[2] === "Primaria" ? 10 + n : 20 + n;
  }
  if (g === "Secundaria") return 30;
  if (g === "Bachillerato") return 40;
  if (g === "Sin escuela") return 90;
  return 50;
}

export type MetricasEdicion = {
  totalParticipantes: number;
  /** Todas las actividades de la edición, de cualquier tipo. */
  totalSesiones: number;
  /**
   * Solo las que cuentan para la constancia. Hoy son las de pasaporte, pero el
   * nombre no lo fija: sale de `TIPOS_QUE_CUENTAN_PARA_CONSTANCIA`, así que si
   * mañana cuenta también la lectura, este número la incluye sin tocar nada.
   * Es el número contra el que se lee `Edicion.minAsistencias`.
   */
  totalSesionesQueCuentan: number;
  /** Desglose por tipo, en el orden del catálogo. Los tipos sin nada salen en 0. */
  porTipo: { tipo: TipoSesion; sesiones: number; asistencias: number }[];
  promedioAsistencia: number;
  totalConstancias: number;
  porEscuela: { escuela: string; cantidad: number }[];
  porGrado: { grado: string; cantidad: number }[];
  porNivel: { escuela: string; cantidad: number }[];
  porCiudad: { escuela: string; cantidad: number }[];
  clasesResumen: {
    nombre: string;
    tipo: TipoSesion;
    sesiones: number;
    asistenciaPromedio: number;
  }[];
  // ── nuevos agregados ──
  tendencia: { fecha: string; etiqueta: string; presentes: number }[];
  porEdad: { edad: number; cantidad: number }[];
  porGenero: { genero: "FEMENINO" | "MASCULINO" | "Sin especificar"; cantidad: number }[];
  rankingClases: { nombre: string; tipo: TipoSesion; asistentes: number }[];
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
          tipo: true,
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

  // ── Desglose por tipo de actividad ──────────────────────────────────────────
  // Se cuenta sobre `clases`, que ya viene de la base con su tipo. Los tres
  // tipos aparecen siempre, aunque estén en cero: una edición sin eventos tiene
  // que poder decirlo, no omitir la fila.
  const sesionesPorTipo = new Map<TipoSesion, number>();
  const asistenciasPorTipo = new Map<TipoSesion, number>();
  for (const c of clases) {
    const sesiones = c.sesiones.length;
    const asistencias = c.sesiones.reduce((acc, s) => acc + s.asistencias.length, 0);
    sesionesPorTipo.set(c.tipo, (sesionesPorTipo.get(c.tipo) ?? 0) + sesiones);
    asistenciasPorTipo.set(c.tipo, (asistenciasPorTipo.get(c.tipo) ?? 0) + asistencias);
  }
  const porTipo = TIPOS_SESION.map(({ valor }) => ({
    tipo: valor as TipoSesion,
    sesiones: sesionesPorTipo.get(valor) ?? 0,
    asistencias: asistenciasPorTipo.get(valor) ?? 0,
  }));

  const totalSesionesQueCuentan = porTipo
    .filter((t) => cuentaParaConstancia(t.tipo))
    .reduce((acc, t) => acc + t.sesiones, 0);

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
    const n = etiquetaNivel(i.participante.nivel);
    nivelCounts.set(n, (nivelCounts.get(n) ?? 0) + 1);
    const c = i.participante.ciudad?.trim() || "Sin especificar";
    ciudadCounts.set(c, (ciudadCounts.get(c) ?? 0) + 1);
  }

  const porEscuela = Array.from(escuelaCounts.entries())
    .map(([escuela, cantidad]) => ({ escuela, cantidad }))
    .sort((a, b) => b.cantidad - a.cantidad);

  const porGrado = Array.from(gradoCounts.entries())
    .map(([grado, cantidad]) => ({ grado, cantidad }))
    .sort((a, b) => ordenGrado(a.grado) - ordenGrado(b.grado));

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
    return { nombre: c.nombre, tipo: c.tipo, sesiones: c.sesiones.length, asistenciaPromedio };
  });

  // ── Tendencia: presentes por fecha (programa a lo largo del tiempo) ──────────
  const fechaMap = new Map<string, number>();
  for (const c of clases) {
    for (const s of c.sesiones) {
      const key = aISOFecha(s.fecha);
      fechaMap.set(key, (fechaMap.get(key) ?? 0) + s.asistencias.length);
    }
  }
  const tendencia = Array.from(fechaMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([fecha, presentes]) => ({
      fecha,
      etiqueta: formatearFecha(fecha, "corta"),
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
      tipo: c.tipo,
      asistentes: c.sesiones.reduce((acc, s) => acc + s.asistencias.length, 0),
    }))
    .sort((a, b) => b.asistentes - a.asistentes);

  return {
    totalParticipantes,
    totalSesiones,
    totalSesionesQueCuentan,
    porTipo,
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
// Análisis de ASISTENCIA por sesión.
//
// Dos fuentes conviven: los totales agregados que trae el Excel del organizador
// (`ResumenSesion`) y la lista individual que se pasa en la aplicación
// (`Asistencia`). Qué cuenta como capturada y con qué precedencia se combinan
// está en un solo sitio: `./asistencia-de-sesion`.
// ─────────────────────────────────────────────────────────────────────────────

export type MetricasAsistencia = {
  /**
   * Sesiones registradas en la edición. Es el valor de «Sesiones registradas»
   * en el dashboard: un conteo, no una fracción. Una sesión cuenta desde que se
   * crea — ver `./asistencia-de-sesion` para por qué no hay denominador.
   */
  totalSesiones: number;
  /**
   * De esas, las que tienen asistencia registrada, de cualquiera de las dos
   * fuentes. Numerador de «Asistencia capturada», la métrica que sí se mueve.
   */
  sesionesCapturadas: number;
  /** De las capturadas, las que traen los totales agregados del Excel. */
  sesionesConAgregado: number;
  /** De las capturadas, las que se registraron pasando lista en la aplicación. */
  sesionesConLista: number;
  /**
   * Sesiones registradas que siguen sin asistencia capturada. Es lo que le
   * falta por hacer al equipo, y decirlo es lo que vuelve accionable la cifra.
   */
  sesionesSinCapturar: number;
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
      asistencias: SELECCION_LISTA,
    },
  });

  // Las sesiones registradas son, simplemente, las que existen: una cuenta
  // desde que se crea. La fecha no interviene.
  const totalSesiones = sesiones.length;

  // Captura: cada sesión con su asistencia efectiva (el agregado si lo hay, si
  // no la lista individual) o `null` si nadie la ha registrado todavía.
  const conDatos = sesiones
    .map((s) => ({ s, a: asistenciaDeSesion(s) }))
    .filter(
      (x): x is { s: (typeof sesiones)[number]; a: AsistenciaDeSesion } => x.a !== null,
    );
  const sesionesConAgregado = conDatos.filter((x) => x.a.origen === "AGREGADA").length;
  const sesionesConLista = conDatos.filter((x) => x.a.origen === "LISTA").length;
  const sesionesSinCapturar = totalSesiones - conDatos.length;

  const porSesion = conDatos.map(({ s, a }) => ({
    etiqueta: formatearFecha(s.fecha, "corta"),
    tema: s.temas ?? s.clase.nombre,
    ninas: a.ninas,
    ninos: a.ninos,
    total: a.total,
  }));

  const totalNinas = conDatos.reduce((acc, { a }) => acc + a.ninas, 0);
  const totalNinos = conDatos.reduce((acc, { a }) => acc + a.ninos, 0);
  const totalMamas = conDatos.reduce((acc, { a }) => acc + a.mamas, 0);
  const totalPapas = conDatos.reduce((acc, { a }) => acc + a.papas, 0);
  const totalEventos = conDatos.reduce((acc, { a }) => acc + a.total, 0);
  const picoSesion = conDatos.length ? Math.max(...conDatos.map(({ a }) => a.total)) : 0;
  // El promedio se divide entre las sesiones CAPTURADAS, no entre el total
  // registrado: dividir entre doce lo que se contó en siete inventaría una
  // caída de asistencia que nadie midió.
  const promedioPorSesion = conDatos.length
    ? Math.round(totalEventos / conDatos.length)
    : 0;

  const tendencia = conDatos.map(({ s, a }) => ({
    fecha: aISOFecha(s.fecha),
    etiqueta: formatearFecha(s.fecha, "corta"),
    presentes: a.total,
  }));

  // Asistencia por edad (suma de eventos por edad sobre todas las sesiones)
  const edadMap = new Map<number, number>();
  for (const { a } of conDatos) {
    for (const [edad, cant] of Object.entries(a.porEdad)) {
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
  for (const { a } of conDatos) {
    nivelSum.Preescolar += a.preescolar;
    nivelSum.Primaria += a.primaria;
    nivelSum.Secundaria += a.secundaria;
    nivelSum["Media superior"] += a.mediaSuperior;
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
    totalSesiones,
    sesionesCapturadas: conDatos.length,
    sesionesConAgregado,
    sesionesConLista,
    sesionesSinCapturar,
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

// ─────────────────────────────────────────────────────────────────────────────
// ANÁLISIS PROFUNDO de la edición activa — cruces y hallazgos para el organizador.
// Combina el registro (51 niños) con la asistencia agregada (totales por sesión).
// ─────────────────────────────────────────────────────────────────────────────

type SerieDual = { etiqueta: string; tema?: string; a: number; b: number };

export type AnalisisProfundo = {
  // Registro
  totalNinos: number;
  totalNinas: number;
  totalNinosM: number;
  pctNinas: number;
  edadPromedio: number;
  edadMin: number;
  edadMax: number;
  numEscuelas: number;
  escuelaTop: { nombre: string; cantidad: number; pct: number } | null;
  numContactos: number;
  // Asistencia — misma definición de «capturada» que el dashboard.
  /** De las sesiones registradas, cuántas tienen asistencia capturada. */
  sesionesCapturadas: number;
  sesionesTotal: number;
  promedioAsist: number;
  picoAsist: { tema: string; total: number } | null;
  minAsist: { tema: string; total: number } | null;
  caidaPct: number; // caída de la última sesión con datos respecto a la primera
  totalAcompanantes: number;
  ratioAcompanantes: number; // acompañantes por cada 10 niños (eventos)
  // Distribuciones cruzadas
  generoPorNivel: SerieDual[]; // a=niñas, b=niños por nivel
  edadGenero: SerieDual[]; // a=niñas, b=niños por edad
  concentracionEscuelas: { escuela: string; cantidad: number; pct: number; acumPct: number }[];
  registrosPorContacto: { contacto: string; cantidad: number; ejemplo: string; label: string | null }[];
  acompanantesPorSesion: SerieDual[]; // a=mamás, b=papás por sesión
  retencion: { fecha: string; etiqueta: string; presentes: number }[];
};

export async function obtenerAnalisisProfundo(
  edicionId: string,
): Promise<AnalisisProfundo> {
  const [inscripciones, sesiones] = await Promise.all([
    prisma.inscripcion.findMany({
      where: { edicionId },
      select: {
        participante: {
          select: {
            edad: true,
            genero: true,
            nivel: true,
            escuela: true,
            telefono: true,
            correo: true,
            nombre: true,
            apellidos: true,
          },
        },
      },
    }),
    prisma.sesion.findMany({
      where: { clase: { edicionId } },
      orderBy: { fecha: "asc" },
      select: {
        fecha: true,
        temas: true,
        clase: { select: { nombre: true } },
        resumen: true,
        asistencias: SELECCION_LISTA,
      },
    }),
  ]);

  const parts = inscripciones.map((i) => i.participante);
  const totalNinos = parts.length;
  const totalNinas = parts.filter((p) => p.genero === "FEMENINO").length;
  const totalNinosM = parts.filter((p) => p.genero === "MASCULINO").length;
  const edades = parts.map((p) => p.edad).filter((e) => e > 0);
  const edadPromedio = edades.length
    ? Math.round((edades.reduce((a, b) => a + b, 0) / edades.length) * 10) / 10
    : 0;

  // Escuelas
  const escMap = new Map<string, number>();
  for (const p of parts) escMap.set(p.escuela, (escMap.get(p.escuela) ?? 0) + 1);
  const escOrden = Array.from(escMap.entries()).sort((a, b) => b[1] - a[1]);
  let acum = 0;
  const concentracionEscuelas = escOrden.map(([escuela, cantidad]) => {
    const pct = Math.round((cantidad / totalNinos) * 100);
    acum += cantidad;
    return { escuela, cantidad, pct, acumPct: Math.round((acum / totalNinos) * 100) };
  });
  const escuelaTop = concentracionEscuelas[0]
    ? {
        nombre: concentracionEscuelas[0].escuela,
        cantidad: concentracionEscuelas[0].cantidad,
        pct: concentracionEscuelas[0].pct,
      }
    : null;

  // Género por nivel
  const nivelMap = new Map<string, { a: number; b: number }>();
  for (const p of parts) {
    const lbl = etiquetaNivel(p.nivel);
    if (!nivelMap.has(lbl)) nivelMap.set(lbl, { a: 0, b: 0 });
    const slot = nivelMap.get(lbl)!;
    if (p.genero === "FEMENINO") slot.a++;
    else slot.b++;
  }
  const generoPorNivel: SerieDual[] = Array.from(nivelMap.entries())
    .sort((x, y) => (NIVEL_ORDEN[x[0]] ?? 99) - (NIVEL_ORDEN[y[0]] ?? 99))
    .map(([etiqueta, v]) => ({ etiqueta, a: v.a, b: v.b }));

  // Edad × género
  const edadMap = new Map<number, { a: number; b: number }>();
  for (const p of parts) {
    if (!p.edad) continue;
    if (!edadMap.has(p.edad)) edadMap.set(p.edad, { a: 0, b: 0 });
    const slot = edadMap.get(p.edad)!;
    if (p.genero === "FEMENINO") slot.a++;
    else slot.b++;
  }
  const edadGenero: SerieDual[] = Array.from(edadMap.entries())
    .sort((x, y) => x[0] - y[0])
    .map(([edad, v]) => ({ etiqueta: `${edad}`, a: v.a, b: v.b }));

  // Registros por contacto (teléfono; fallback correo). El valor crudo del
  // contacto NO se expone al cliente: la página lo enmascara antes de render.
  const contactoMap = new Map<string, { count: number; ejemplo: string }>();
  for (const p of parts) {
    const c = (p.telefono || p.correo || "Sin contacto").trim();
    if (!contactoMap.has(c)) contactoMap.set(c, { count: 0, ejemplo: `${p.nombre} ${p.apellidos}` });
    contactoMap.get(c)!.count++;
  }
  const registrosPorContacto = Array.from(contactoMap.entries())
    .map(([contacto, v]) => ({
      contacto,
      cantidad: v.count,
      ejemplo: v.ejemplo,
      label: null as string | null,
    }))
    .sort((a, b) => b.cantidad - a.cantidad);

  // Un contacto puede ser una familia (2-3 hermanos) o un grupo organizado que
  // inscribe a muchos niños de golpe: en 2026 fue el Grupo Zarigüeyas, y verlo
  // etiquetado evita leer sus 6 registros como "una familia enorme".
  //
  // Antes se identificaba por volumen (el contacto más numeroso con 5 o más),
  // para no incrustar el teléfono real en un repo público. Pero el volumen no
  // distingue un grupo de una familia grande: en cualquier edición nueva, el
  // contacto más numeroso quedaba bautizado "Grupo Zarigüeyas" aunque el grupo
  // no existiera ahí. El reporte inventaba un grupo.
  //
  // Ahora la identidad viene del entorno (CONTACTO_GRUPO = el teléfono o correo
  // real; CONTACTO_GRUPO_ETIQUETA = cómo llamarlo). Sin configuración, ningún
  // contacto lleva etiqueta, que es lo correcto para una edición nueva.
  //
  // "Sin contacto" queda excluido a propósito: no es un contacto sino el cajón
  // de los registros sin teléfono ni correo, y aparece en todas las ediciones.
  // Justo ese cajón era el que se llevaba la etiqueta cuando 5 o más niños
  // venían sin datos de contacto.
  const contactoGrupo = (process.env.CONTACTO_GRUPO ?? "").trim();
  if (contactoGrupo && contactoGrupo !== "Sin contacto") {
    const etiqueta = process.env.CONTACTO_GRUPO_ETIQUETA?.trim() || "Grupo Zarigüeyas";
    const fila = registrosPorContacto.find((c) => c.contacto === contactoGrupo);
    if (fila) fila.label = etiqueta;
  }
  const numContactos = registrosPorContacto.length;

  // Asistencia de las sesiones CAPTURADAS: el agregado del Excel cuando lo hay,
  // si no la lista pasada en la aplicación. Antes solo se miraba el agregado,
  // así que una edición capturada en la app salía con todo en cero.
  const conDatos = sesiones
    .map((s) => ({ s, a: asistenciaDeSesion(s) }))
    .filter(
      (x): x is { s: (typeof sesiones)[number]; a: AsistenciaDeSesion } => x.a !== null,
    );
  const totalEventos = conDatos.reduce((acc, { a }) => acc + a.total, 0);
  const promedioAsist = conDatos.length
    ? Math.round(totalEventos / conDatos.length)
    : 0;
  const totalAcompanantes = conDatos.reduce((acc, { a }) => acc + a.mamas + a.papas, 0);
  const ratioAcompanantes = totalEventos
    ? Math.round((totalAcompanantes / totalEventos) * 100) / 10
    : 0;

  const sesionesData = conDatos.map(({ s, a }) => ({
    tema: s.temas ?? s.clase.nombre,
    total: a.total,
    mamas: a.mamas,
    papas: a.papas,
    fecha: new Date(s.fecha),
  }));
  const picoAsist = sesionesData.length
    ? sesionesData.reduce((m, s) => (s.total > m.total ? s : m))
    : null;
  const minAsist = sesionesData.length
    ? sesionesData.reduce((m, s) => (s.total < m.total ? s : m))
    : null;
  const caidaPct =
    sesionesData.length >= 2 && sesionesData[0].total > 0
      ? Math.round((1 - sesionesData[sesionesData.length - 1].total / sesionesData[0].total) * 100)
      : 0;

  const acompanantesPorSesion: SerieDual[] = sesionesData.map((s) => ({
    etiqueta: formatearFecha(s.fecha, "corta"),
    tema: s.tema,
    a: s.mamas,
    b: s.papas,
  }));
  const retencion = sesionesData.map((s) => ({
    fecha: aISOFecha(s.fecha),
    etiqueta: formatearFecha(s.fecha, "corta"),
    presentes: s.total,
  }));

  return {
    totalNinos,
    totalNinas,
    totalNinosM,
    pctNinas: totalNinos ? Math.round((totalNinas / totalNinos) * 100) : 0,
    edadPromedio,
    edadMin: edades.length ? Math.min(...edades) : 0,
    edadMax: edades.length ? Math.max(...edades) : 0,
    numEscuelas: escMap.size,
    escuelaTop,
    numContactos,
    sesionesCapturadas: conDatos.length,
    sesionesTotal: sesiones.length,
    promedioAsist,
    picoAsist: picoAsist ? { tema: picoAsist.tema, total: picoAsist.total } : null,
    minAsist: minAsist ? { tema: minAsist.tema, total: minAsist.total } : null,
    caidaPct,
    totalAcompanantes,
    ratioAcompanantes,
    generoPorNivel,
    edadGenero,
    concentracionEscuelas,
    registrosPorContacto,
    acompanantesPorSesion,
    retencion,
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
          edad: true,
          genero: true,
          grado: true,
          nivel: true,
          escuela: true,
          ciudad: true,
          correo: true,
          telefono: true,
        },
      },
    },
  });

  const generoLabel = (g: "FEMENINO" | "MASCULINO" | null) =>
    g === "FEMENINO" ? "Niña" : g === "MASCULINO" ? "Niño" : "—";

  // Anti CSV/formula-injection: si un valor empieza con = + - @ (o tab/CR),
  // Excel podría interpretarlo como fórmula al abrir el archivo. Lo neutralizamos.
  const safe = (v: string | null | undefined) => {
    const s = (v ?? "—").toString();
    return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  };

  return inscripciones.map((i, idx) => ({
    "#": idx + 1,
    Nombre: safe(i.participante.nombre),
    Apellidos: safe(i.participante.apellidos),
    Edad: i.participante.edad,
    Género: generoLabel(i.participante.genero),
    Grado: safe(i.participante.grado),
    // En el export se respeta lo que hay en la base cuando no es un nivel
    // conocido: la hoja la revisa una persona y un valor raro tiene que verse,
    // no quedar escondido detrás de "Sin especificar".
    Nivel:
      NIVEL_LABEL[i.participante.nivel as Nivel] ??
      i.participante.nivel ??
      "—",
    Escuela: safe(i.participante.escuela),
    Ciudad: safe(i.participante.ciudad),
    Correo: safe(i.participante.correo),
    Teléfono: safe(i.participante.telefono),
  }));
}
