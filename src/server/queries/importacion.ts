// Importación de Excel: comparar contra la base (vista previa) y aplicar.
//
// Idempotencia: cada entidad tiene una clave natural y se busca antes de crear.
//  · Participante → nombre + apellidos normalizados (sin acentos ni mayúsculas).
//    Es GLOBAL: un niño que repite otro año es el MISMO Participante y solo se
//    le agrega una Inscripcion nueva.
//  · Clase        → nombre normalizado dentro de la edición.
//  · Sesion       → clase + día.
//  · Asistencia   → inscripción + sesión (índice único en el schema).
// Volver a subir el mismo archivo no duplica nada: todo cae en «sin cambios».

import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import type { TipoImportacion } from "@/lib/importacion/columnas";
import { claveFecha, claveParticipante, normalizar } from "@/lib/importacion/texto";
import type {
  Incidencia,
  FilaLeida,
  ColumnaSesionDetectada,
} from "@/lib/importacion/parseo";
import type {
  FilaAsistencia,
  FilaParticipante,
  FilaSesion,
} from "@/lib/schemas/importacion.schema";

type Cliente = Prisma.TransactionClient;

// ── Tipos del plan ────────────────────────────────────────────────────────────

export type TonoAccion = "crear" | "reutilizar" | "actualizar" | "sinCambios" | "omitir";

export interface AccionFila {
  fila: number;
  sujeto: string;
  accion: TonoAccion;
  detalle: string;
}

export interface EdicionDestino {
  id: string;
  anio: number;
  nombre: string;
}

export interface PlanImportacion {
  tipo: TipoImportacion;
  edicion: EdicionDestino;
  resumen: { etiqueta: string; valor: number }[];
  acciones: AccionFila[];
  errores: Incidencia[];
  avisos: Incidencia[];
  puedeImportar: boolean;
}

export interface ResultadoEjecucion {
  resumen: { etiqueta: string; valor: number }[];
  filasAplicadas: number;
}

export class ErrorImportacion extends Error {}

const ETIQUETA_ACCION: Record<TonoAccion, string> = {
  crear: "Se creará",
  reutilizar: "Se reutilizará",
  actualizar: "Se actualizará",
  sinCambios: "Sin cambios",
  omitir: "Se omitirá",
};

export function etiquetaAccion(accion: TonoAccion): string {
  return ETIQUETA_ACCION[accion];
}

// ── Edición destino ───────────────────────────────────────────────────────────

export async function obtenerEdicionDestino(edicionId: string): Promise<EdicionDestino> {
  const edicion = await prisma.edicion.findUnique({
    where: { id: edicionId },
    select: { id: true, anio: true, nombre: true },
  });
  if (!edicion) throw new ErrorImportacion("La edición seleccionada no existe.");
  return edicion;
}

export async function listarEdicionesParaImportar(): Promise<EdicionDestino[]> {
  return prisma.edicion.findMany({
    orderBy: [{ activa: "desc" }, { anio: "desc" }],
    select: { id: true, anio: true, nombre: true },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// TIPO 1 · Participantes e inscripciones
// ─────────────────────────────────────────────────────────────────────────────

interface OperacionParticipante {
  fila: number;
  clave: string;
  datos: FilaParticipante;
  participanteId: string | null;
  crearParticipante: boolean;
  actualizaciones: Prisma.ParticipanteUpdateInput;
  crearInscripcion: boolean;
  accion: TonoAccion;
  detalle: string;
  sujeto: string;
}

function cambiosDeParticipante(
  datos: FilaParticipante,
  actual: {
    edad: number;
    escuela: string;
    grado: string;
    genero: string | null;
    nivel: string | null;
    correo: string | null;
    telefono: string | null;
    ciudad: string | null;
  },
): { updates: Prisma.ParticipanteUpdateInput; descripciones: string[] } {
  const updates: Prisma.ParticipanteUpdateInput = {};
  const descripciones: string[] = [];
  const provisto = new Set(datos.provistos);

  const proponer = <K extends keyof typeof actual>(
    campo: K,
    etiqueta: string,
    nuevo: unknown,
    forzar = false,
  ) => {
    if (!forzar && !provisto.has(campo as string)) return;
    const previo = actual[campo];
    if (nuevo === previo) return;
    if (nuevo === "" || nuevo === null) return;
    (updates as Record<string, unknown>)[campo as string] = nuevo;
    const antes = previo === null || previo === "" ? "sin dato" : `«${previo}»`;
    descripciones.push(`${etiqueta}: ${antes} → «${nuevo}»`);
  };

  proponer("edad", "edad", datos.edad);
  proponer("escuela", "escuela", datos.escuela);
  proponer("grado", "grado", datos.grado);
  proponer("genero", "género", datos.genero);
  // El nivel se rellena también cuando la base lo tiene vacío, aunque el
  // archivo no traiga la columna: es un dato derivado, no un dato del usuario.
  proponer("nivel", "nivel", datos.nivel, actual.nivel === null);
  proponer("correo", "correo", datos.correo);
  proponer("telefono", "teléfono", datos.telefono);
  proponer("ciudad", "ciudad", datos.ciudad);

  return { updates, descripciones };
}

async function construirOperacionesParticipantes(
  cliente: Cliente,
  edicion: EdicionDestino,
  filas: FilaLeida<FilaParticipante>[],
): Promise<{ operaciones: OperacionParticipante[]; avisos: Incidencia[] }> {
  const existentes = await cliente.participante.findMany({
    select: {
      id: true,
      nombre: true,
      apellidos: true,
      edad: true,
      escuela: true,
      grado: true,
      genero: true,
      nivel: true,
      correo: true,
      telefono: true,
      ciudad: true,
      inscripciones: {
        select: { edicionId: true, edicion: { select: { anio: true } } },
      },
    },
  });

  const porClave = new Map(
    existentes.map((p) => [claveParticipante(p.nombre, p.apellidos), p]),
  );

  const operaciones: OperacionParticipante[] = [];
  const avisos: Incidencia[] = [];
  const vistas = new Map<string, number>();

  for (const { fila, datos } of filas) {
    const clave = claveParticipante(datos.nombre, datos.apellidos);
    const sujeto = `${datos.nombre} ${datos.apellidos}`;

    const previa = vistas.get(clave);
    if (previa !== undefined) {
      avisos.push({
        fila,
        mensaje: `«${sujeto}» ya aparece en la fila ${previa}; esta fila se omite para no duplicar.`,
      });
      operaciones.push({
        fila, clave, datos, participanteId: null, crearParticipante: false,
        actualizaciones: {}, crearInscripcion: false, accion: "omitir",
        detalle: `Repetido dentro del archivo (fila ${previa}).`, sujeto,
      });
      continue;
    }
    vistas.set(clave, fila);

    const existente = porClave.get(clave);

    if (!existente) {
      operaciones.push({
        fila, clave, datos, participanteId: null, crearParticipante: true,
        actualizaciones: {}, crearInscripcion: true, accion: "crear",
        detalle: `Alta nueva e inscripción en ${edicion.anio}.`, sujeto,
      });
      continue;
    }

    const yaInscrito = existente.inscripciones.some((i) => i.edicionId === edicion.id);
    const otrosAnios = existente.inscripciones
      .filter((i) => i.edicionId !== edicion.id)
      .map((i) => i.edicion.anio)
      .sort((a, b) => a - b);
    const { updates, descripciones } = cambiosDeParticipante(datos, existente);
    const hayCambios = Object.keys(updates).length > 0;

    let accion: TonoAccion;
    const partes: string[] = [];

    if (!yaInscrito) {
      accion = "reutilizar";
      partes.push(
        listaDeAnios(otrosAnios)
          ? `Ya existía (${listaDeAnios(otrosAnios)}); se reutiliza y se le crea la inscripción de ${edicion.anio}.`
          : `Ya existía en el padrón; se reutiliza y se le crea la inscripción de ${edicion.anio}.`,
      );
    } else if (hayCambios) {
      accion = "actualizar";
      partes.push(`Ya inscrito en ${edicion.anio}.`);
    } else {
      accion = "sinCambios";
      partes.push(`Ya inscrito en ${edicion.anio}, sin datos que cambiar.`);
    }
    if (hayCambios) partes.push(descripciones.join("; "));

    operaciones.push({
      fila, clave, datos,
      participanteId: existente.id,
      crearParticipante: false,
      actualizaciones: updates,
      crearInscripcion: !yaInscrito,
      accion,
      detalle: partes.join(" "),
      sujeto,
    });
  }

  return { operaciones, avisos };
}

/** "ediciones 2024 y 2025" / "edición 2024" / "" */
function listaDeAnios(anios: number[]): string {
  if (anios.length === 0) return "";
  if (anios.length === 1) return `edición ${anios[0]}`;
  return `ediciones ${anios.slice(0, -1).join(", ")} y ${anios[anios.length - 1]}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// TIPO 2 · Sesiones y asistencia agregada
// ─────────────────────────────────────────────────────────────────────────────

interface OperacionSesion {
  fila: number;
  datos: FilaSesion;
  claseId: string | null;
  claseNueva: boolean;
  sesionId: string | null;
  accion: TonoAccion;
  detalle: string;
  sujeto: string;
}

async function construirOperacionesSesiones(
  cliente: Cliente,
  edicion: EdicionDestino,
  filas: FilaLeida<FilaSesion>[],
): Promise<{ operaciones: OperacionSesion[]; avisos: Incidencia[] }> {
  const clases = await cliente.clase.findMany({
    where: { edicionId: edicion.id },
    select: {
      id: true,
      nombre: true,
      sesiones: { select: { id: true, fecha: true, temas: true } },
    },
  });

  const clasePorNombre = new Map(clases.map((c) => [normalizar(c.nombre), c.id]));
  const sesionPorClaveDia = new Map<string, string>();
  for (const c of clases) {
    for (const s of c.sesiones) {
      sesionPorClaveDia.set(`${c.id}|${claveFecha(s.fecha)}`, s.id);
    }
  }

  const operaciones: OperacionSesion[] = [];
  const avisos: Incidencia[] = [];
  const vistas = new Map<string, number>();
  // Clases que este mismo archivo va a crear (para no crearlas dos veces).
  const clasesPendientes = new Set<string>();

  for (const { fila, datos } of filas) {
    const claveClase = normalizar(datos.clase);
    const dia = claveFecha(datos.fecha);
    const sujeto = `${datos.tema} · ${dia}`;
    const claveFilaUnica = `${claveClase}|${dia}`;

    const previa = vistas.get(claveFilaUnica);
    if (previa !== undefined) {
      avisos.push({
        fila,
        mensaje: `La sesión «${datos.clase}» del ${dia} ya aparece en la fila ${previa}; esta fila se omite.`,
      });
      operaciones.push({
        fila, datos, claseId: null, claseNueva: false, sesionId: null,
        accion: "omitir", detalle: `Repetida dentro del archivo (fila ${previa}).`, sujeto,
      });
      continue;
    }
    vistas.set(claveFilaUnica, fila);

    const claseId = clasePorNombre.get(claveClase) ?? null;
    const claseNueva = claseId === null && !clasesPendientes.has(claveClase);
    if (claseId === null) clasesPendientes.add(claveClase);

    const sesionId = claseId ? sesionPorClaveDia.get(`${claseId}|${dia}`) ?? null : null;

    const partes: string[] = [];
    partes.push(claseId ? `Clase «${datos.clase}» existente.` : `Se creará la clase «${datos.clase}».`);
    partes.push(sesionId ? `Sesión del ${dia} ya registrada: se actualiza.` : `Se creará la sesión del ${dia}.`);
    if (datos.conDatos) {
      partes.push(
        `Totales: ${datos.ninas} niñas + ${datos.ninos} niños = ${datos.total}` +
          (datos.mamas || datos.papas ? ` · ${datos.mamas} mamás, ${datos.papas} papás.` : "."),
      );
    } else {
      partes.push("Sin totales de asistencia en el archivo.");
    }

    operaciones.push({
      fila, datos, claseId, claseNueva, sesionId,
      accion: sesionId ? "actualizar" : "crear",
      detalle: partes.join(" "),
      sujeto,
    });
  }

  return { operaciones, avisos };
}

// ─────────────────────────────────────────────────────────────────────────────
// TIPO 3 · Asistencia nominal
// ─────────────────────────────────────────────────────────────────────────────

interface OperacionAsistencia {
  fila: number;
  sujeto: string;
  inscripcionId: string | null;
  marcas: { sesionId: string; presente: boolean; existente: boolean; cambia: boolean }[];
  accion: TonoAccion;
  detalle: string;
}

interface SesionResuelta {
  columna: string;
  sesionId: string | null;
  error?: string;
}

async function resolverColumnasSesion(
  cliente: Cliente,
  edicion: EdicionDestino,
  columnas: ColumnaSesionDetectada[],
): Promise<{ resueltas: SesionResuelta[]; errores: Incidencia[] }> {
  const sesiones = await cliente.sesion.findMany({
    where: { clase: { edicionId: edicion.id } },
    select: {
      id: true,
      fecha: true,
      temas: true,
      clase: { select: { nombre: true } },
    },
    orderBy: { fecha: "asc" },
  });

  const porDia = new Map<string, string[]>();
  const porNombre = new Map<string, string[]>();
  const agregar = (mapa: Map<string, string[]>, clave: string, id: string) => {
    if (!clave) return;
    const lista = mapa.get(clave) ?? [];
    lista.push(id);
    mapa.set(clave, lista);
  };
  for (const s of sesiones) {
    agregar(porDia, claveFecha(s.fecha), s.id);
    agregar(porNombre, normalizar(s.clase.nombre), s.id);
    if (s.temas) agregar(porNombre, normalizar(s.temas), s.id);
  }

  const resueltas: SesionResuelta[] = [];
  const errores: Incidencia[] = [];

  for (const col of columnas) {
    const candidatos = col.fecha
      ? porDia.get(claveFecha(col.fecha)) ?? []
      : porNombre.get(normalizar(col.etiqueta)) ?? [];

    if (candidatos.length === 1) {
      resueltas.push({ columna: col.etiqueta, sesionId: candidatos[0] });
      continue;
    }
    if (candidatos.length === 0) {
      const pista = col.fecha
        ? `no hay ninguna sesión el ${claveFecha(col.fecha)} en la edición ${edicion.anio}`
        : `no hay ninguna clase ni sesión llamada así en la edición ${edicion.anio}`;
      errores.push({
        fila: null,
        mensaje: `La columna «${col.etiqueta}» no corresponde a ninguna sesión: ${pista}. Importa primero las sesiones.`,
      });
      resueltas.push({ columna: col.etiqueta, sesionId: null, error: pista });
      continue;
    }
    errores.push({
      fila: null,
      mensaje: `La columna «${col.etiqueta}» coincide con ${candidatos.length} sesiones distintas. Usa el nombre de la clase como encabezado para desambiguar.`,
    });
    resueltas.push({ columna: col.etiqueta, sesionId: null, error: "ambigua" });
  }

  return { resueltas, errores };
}

async function construirOperacionesAsistencia(
  cliente: Cliente,
  edicion: EdicionDestino,
  filas: FilaLeida<FilaAsistencia>[],
  columnas: ColumnaSesionDetectada[],
): Promise<{
  operaciones: OperacionAsistencia[];
  errores: Incidencia[];
  avisos: Incidencia[];
}> {
  const errores: Incidencia[] = [];
  const avisos: Incidencia[] = [];

  const { resueltas, errores: erroresColumna } = await resolverColumnasSesion(
    cliente,
    edicion,
    columnas,
  );
  errores.push(...erroresColumna);
  const sesionPorColumna = new Map(
    resueltas.filter((r) => r.sesionId).map((r) => [r.columna, r.sesionId as string]),
  );

  const inscripciones = await cliente.inscripcion.findMany({
    where: { edicionId: edicion.id },
    select: {
      id: true,
      participante: { select: { nombre: true, apellidos: true } },
      asistencias: { select: { sesionId: true, presente: true } },
    },
  });

  const porClave = new Map(
    inscripciones.map((i) => [
      claveParticipante(i.participante.nombre, i.participante.apellidos),
      i,
    ]),
  );

  const operaciones: OperacionAsistencia[] = [];
  const vistas = new Map<string, number>();

  for (const { fila, datos } of filas) {
    const sujeto = `${datos.nombre} ${datos.apellidos}`;
    const clave = claveParticipante(datos.nombre, datos.apellidos);

    const previa = vistas.get(clave);
    if (previa !== undefined) {
      avisos.push({
        fila,
        mensaje: `«${sujeto}» ya aparece en la fila ${previa}; esta fila se omite.`,
      });
      operaciones.push({
        fila, sujeto, inscripcionId: null, marcas: [],
        accion: "omitir", detalle: `Repetido dentro del archivo (fila ${previa}).`,
      });
      continue;
    }
    vistas.set(clave, fila);

    const inscripcion = porClave.get(clave);
    if (!inscripcion) {
      errores.push({
        fila,
        mensaje: `«${sujeto}» no está inscrito en la edición ${edicion.anio}. Importa primero los participantes o revisa cómo está escrito el nombre.`,
      });
      continue;
    }

    const previas = new Map(inscripcion.asistencias.map((a) => [a.sesionId, a.presente]));
    const marcas: OperacionAsistencia["marcas"] = [];
    for (const marca of datos.marcas) {
      const sesionId = sesionPorColumna.get(marca.columna);
      if (!sesionId) continue; // el error ya se reportó a nivel de columna
      const existente = previas.has(sesionId);
      const cambia = !existente || previas.get(sesionId) !== marca.presente;
      marcas.push({ sesionId, presente: marca.presente, existente, cambia });
    }

    const nuevas = marcas.filter((m) => !m.existente).length;
    const cambiadas = marcas.filter((m) => m.existente && m.cambia).length;
    const presentes = marcas.filter((m) => m.presente).length;

    const accion: TonoAccion =
      nuevas > 0 ? "crear" : cambiadas > 0 ? "actualizar" : "sinCambios";
    const detalle =
      `${presentes} de ${marcas.length} sesiones marcadas como asistió. ` +
      (nuevas ? `${nuevas} registro(s) nuevo(s). ` : "") +
      (cambiadas ? `${cambiadas} registro(s) corregido(s). ` : "") +
      (!nuevas && !cambiadas ? "Ya estaba tal cual en la base." : "");

    operaciones.push({ fila, sujeto, inscripcionId: inscripcion.id, marcas, accion, detalle });
  }

  return { operaciones, errores, avisos };
}

// ─────────────────────────────────────────────────────────────────────────────
// Vista previa
// ─────────────────────────────────────────────────────────────────────────────

function contar(acciones: AccionFila[], tono: TonoAccion): number {
  return acciones.filter((a) => a.accion === tono).length;
}

export interface EntradaPlan {
  tipo: TipoImportacion;
  edicion: EdicionDestino;
  filasParticipantes?: FilaLeida<FilaParticipante>[];
  filasSesiones?: FilaLeida<FilaSesion>[];
  filasAsistencia?: FilaLeida<FilaAsistencia>[];
  columnasSesion?: ColumnaSesionDetectada[];
  erroresParseo: Incidencia[];
  avisosParseo: Incidencia[];
}

export async function planificarImportacion(entrada: EntradaPlan): Promise<PlanImportacion> {
  const errores = [...entrada.erroresParseo];
  const avisos = [...entrada.avisosParseo];
  let acciones: AccionFila[] = [];
  let resumen: { etiqueta: string; valor: number }[] = [];

  if (entrada.tipo === "participantes") {
    const filas = entrada.filasParticipantes ?? [];
    const { operaciones, avisos: av } = await construirOperacionesParticipantes(
      prisma,
      entrada.edicion,
      filas,
    );
    avisos.push(...av);
    acciones = operaciones.map((o) => ({
      fila: o.fila, sujeto: o.sujeto, accion: o.accion, detalle: o.detalle,
    }));
    resumen = [
      { etiqueta: "Participantes nuevos", valor: contar(acciones, "crear") },
      { etiqueta: "Ya existían de otra edición (se reutilizan)", valor: contar(acciones, "reutilizar") },
      { etiqueta: "Datos que se actualizan", valor: contar(acciones, "actualizar") },
      { etiqueta: "Sin cambios", valor: contar(acciones, "sinCambios") },
      { etiqueta: "Filas repetidas que se omiten", valor: contar(acciones, "omitir") },
      {
        etiqueta: `Inscripciones nuevas en ${entrada.edicion.anio}`,
        valor: operaciones.filter((o) => o.crearInscripcion).length,
      },
    ];
  } else if (entrada.tipo === "sesiones") {
    const filas = entrada.filasSesiones ?? [];
    const { operaciones, avisos: av } = await construirOperacionesSesiones(
      prisma,
      entrada.edicion,
      filas,
    );
    avisos.push(...av);
    acciones = operaciones.map((o) => ({
      fila: o.fila, sujeto: o.sujeto, accion: o.accion, detalle: o.detalle,
    }));
    resumen = [
      { etiqueta: "Clases nuevas", valor: operaciones.filter((o) => o.claseNueva).length },
      { etiqueta: "Sesiones nuevas", valor: contar(acciones, "crear") },
      { etiqueta: "Sesiones que se actualizan", valor: contar(acciones, "actualizar") },
      {
        etiqueta: "Sesiones con totales de asistencia",
        valor: operaciones.filter((o) => o.datos.conDatos && o.accion !== "omitir").length,
      },
      { etiqueta: "Filas repetidas que se omiten", valor: contar(acciones, "omitir") },
    ];
  } else {
    const filas = entrada.filasAsistencia ?? [];
    const { operaciones, errores: err, avisos: av } = await construirOperacionesAsistencia(
      prisma,
      entrada.edicion,
      filas,
      entrada.columnasSesion ?? [],
    );
    errores.push(...err);
    avisos.push(...av);
    acciones = operaciones.map((o) => ({
      fila: o.fila, sujeto: o.sujeto, accion: o.accion, detalle: o.detalle,
    }));
    const marcas = operaciones.flatMap((o) => o.marcas);
    resumen = [
      { etiqueta: "Participantes de la lista", valor: operaciones.length },
      { etiqueta: "Asistencias nuevas", valor: marcas.filter((m) => !m.existente).length },
      {
        etiqueta: "Asistencias corregidas",
        valor: marcas.filter((m) => m.existente && m.cambia).length,
      },
      {
        etiqueta: "Sin cambios",
        valor: marcas.filter((m) => m.existente && !m.cambia).length,
      },
    ];
  }

  return {
    tipo: entrada.tipo,
    edicion: entrada.edicion,
    resumen,
    acciones,
    errores,
    avisos,
    puedeImportar: errores.length === 0 && acciones.some((a) => a.accion !== "omitir"),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Ejecución (una sola transacción: o entra todo o no entra nada)
// ─────────────────────────────────────────────────────────────────────────────

const OPCIONES_TX = { maxWait: 15_000, timeout: 120_000 };

export async function ejecutarImportacion(entrada: EntradaPlan): Promise<ResultadoEjecucion> {
  if (entrada.erroresParseo.length) {
    throw new ErrorImportacion(
      "El archivo tiene errores sin resolver; corrígelos y vuelve a intentar.",
    );
  }

  if (entrada.tipo === "participantes") {
    return prisma.$transaction(async (tx) => {
      const { operaciones } = await construirOperacionesParticipantes(
        tx,
        entrada.edicion,
        entrada.filasParticipantes ?? [],
      );
      let creados = 0;
      let reutilizados = 0;
      let actualizados = 0;
      let inscripciones = 0;

      for (const op of operaciones) {
        if (op.accion === "omitir") continue;
        let participanteId = op.participanteId;

        if (op.crearParticipante) {
          const creado = await tx.participante.create({
            data: {
              nombre: op.datos.nombre,
              apellidos: op.datos.apellidos,
              edad: op.datos.edad,
              escuela: op.datos.escuela,
              grado: op.datos.grado,
              genero: op.datos.genero,
              nivel: op.datos.nivel,
              correo: op.datos.correo || null,
              telefono: op.datos.telefono || null,
              ciudad: op.datos.ciudad || null,
            },
            select: { id: true },
          });
          participanteId = creado.id;
          creados++;
        } else if (Object.keys(op.actualizaciones).length > 0) {
          await tx.participante.update({
            where: { id: participanteId as string },
            data: op.actualizaciones,
          });
          actualizados++;
        }

        if (op.crearInscripcion && participanteId) {
          await tx.inscripcion.upsert({
            where: {
              participanteId_edicionId: {
                participanteId,
                edicionId: entrada.edicion.id,
              },
            },
            create: { participanteId, edicionId: entrada.edicion.id },
            update: {},
          });
          inscripciones++;
          if (!op.crearParticipante) reutilizados++;
        }
      }

      return {
        filasAplicadas: operaciones.filter((o) => o.accion !== "omitir").length,
        resumen: [
          { etiqueta: "Participantes creados", valor: creados },
          { etiqueta: "Participantes reutilizados de otra edición", valor: reutilizados },
          { etiqueta: "Participantes actualizados", valor: actualizados },
          { etiqueta: `Inscripciones creadas en ${entrada.edicion.anio}`, valor: inscripciones },
        ],
      };
    }, OPCIONES_TX);
  }

  if (entrada.tipo === "sesiones") {
    return prisma.$transaction(async (tx) => {
      const { operaciones } = await construirOperacionesSesiones(
        tx,
        entrada.edicion,
        entrada.filasSesiones ?? [],
      );
      const clasesPorNombre = new Map<string, string>();
      let clasesCreadas = 0;
      let sesionesCreadas = 0;
      let sesionesActualizadas = 0;
      let resumenes = 0;

      for (const op of operaciones) {
        if (op.accion === "omitir") continue;
        const claveClase = normalizar(op.datos.clase);

        let claseId = op.claseId ?? clasesPorNombre.get(claveClase) ?? null;
        if (!claseId) {
          const clase = await tx.clase.create({
            data: {
              edicionId: entrada.edicion.id,
              nombre: op.datos.clase,
              investigador: op.datos.investigador,
              descripcion: descripcionClase(op.datos),
            },
            select: { id: true },
          });
          claseId = clase.id;
          clasesPorNombre.set(claveClase, claseId);
          clasesCreadas++;
        }

        const dia = claveFecha(op.datos.fecha);
        const existente = await tx.sesion.findFirst({
          where: {
            claseId,
            fecha: {
              gte: new Date(`${dia}T00:00:00.000Z`),
              lt: new Date(`${dia}T23:59:59.999Z`),
            },
          },
          select: { id: true },
        });

        let sesionId: string;
        if (existente) {
          await tx.sesion.update({
            where: { id: existente.id },
            data: { temas: op.datos.tema, notas: op.datos.notas || null },
          });
          sesionId = existente.id;
          sesionesActualizadas++;
        } else {
          const creada = await tx.sesion.create({
            data: {
              claseId,
              fecha: op.datos.fecha,
              temas: op.datos.tema,
              notas: op.datos.notas || null,
            },
            select: { id: true },
          });
          sesionId = creada.id;
          sesionesCreadas++;
        }

        if (op.datos.conDatos) {
          const resumen = {
            ninas: op.datos.ninas,
            ninos: op.datos.ninos,
            total: op.datos.total,
            mamas: op.datos.mamas,
            papas: op.datos.papas,
            preescolar: op.datos.preescolar,
            primaria: op.datos.primaria,
            secundaria: op.datos.secundaria,
            mediaSuperior: op.datos.mediaSuperior,
            porEdad: op.datos.porEdad,
          };
          await tx.resumenSesion.upsert({
            where: { sesionId },
            create: { sesionId, ...resumen },
            update: resumen,
          });
          resumenes++;
        }
      }

      return {
        filasAplicadas: operaciones.filter((o) => o.accion !== "omitir").length,
        resumen: [
          { etiqueta: "Clases creadas", valor: clasesCreadas },
          { etiqueta: "Sesiones creadas", valor: sesionesCreadas },
          { etiqueta: "Sesiones actualizadas", valor: sesionesActualizadas },
          { etiqueta: "Resúmenes de asistencia guardados", valor: resumenes },
        ],
      };
    }, OPCIONES_TX);
  }

  return prisma.$transaction(async (tx) => {
    const { operaciones, errores } = await construirOperacionesAsistencia(
      tx,
      entrada.edicion,
      entrada.filasAsistencia ?? [],
      entrada.columnasSesion ?? [],
    );
    if (errores.length) {
      throw new ErrorImportacion(errores[0].mensaje);
    }

    let creadas = 0;
    let actualizadas = 0;

    for (const op of operaciones) {
      if (op.accion === "omitir" || !op.inscripcionId) continue;
      for (const marca of op.marcas) {
        if (!marca.cambia) continue;
        await tx.asistencia.upsert({
          where: {
            inscripcionId_sesionId: {
              inscripcionId: op.inscripcionId,
              sesionId: marca.sesionId,
            },
          },
          create: {
            inscripcionId: op.inscripcionId,
            sesionId: marca.sesionId,
            presente: marca.presente,
          },
          update: { presente: marca.presente },
        });
        if (marca.existente) actualizadas++;
        else creadas++;
      }
    }

    return {
      filasAplicadas: operaciones.filter((o) => o.accion !== "omitir").length,
      resumen: [
        { etiqueta: "Asistencias creadas", valor: creadas },
        { etiqueta: "Asistencias actualizadas", valor: actualizadas },
      ],
    };
  }, OPCIONES_TX);
}

function descripcionClase(datos: FilaSesion): string {
  const partes: string[] = [];
  if (datos.orden !== null) partes.push(`Sesión ${datos.orden}`);
  if (datos.sede) partes.push(`Sede ${datos.sede}`);
  return partes.join(" · ") || datos.tema;
}
