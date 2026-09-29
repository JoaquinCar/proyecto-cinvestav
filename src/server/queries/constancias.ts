import { prisma } from "@/server/db";
import { getSupabaseAdmin } from "@/lib/supabase";
import { generarPDFConstancia, type DatosConstancia } from "@/lib/pdf/constancia";
import { formatearInstante } from "@/lib/fechas";
// Qué asistencias suman al mínimo y qué sesiones forman el denominador NO se
// decide en este archivo: se decide en src/lib/tipos-sesion.ts, que es el único
// sitio donde se cambia. Aquí solo se aplican los dos filtros.
import { ASISTENCIAS_QUE_CUENTAN, CLASES_QUE_CUENTAN } from "@/lib/tipos-sesion";

// ─────────────────────────────────────────────────────────────────────────────
// LA CONSTANCIA LE TOCA A TODO INSCRITO.
//
// Antes se ganaba: la recibía quien alcanzara `Edicion.minAsistencias`. El
// cliente lo invirtió en reunión —"constancia para todos y un admin puede decir
// a quién no se le da, pero por defecto todos"— y eso cambia quién tiene que
// actuar: ya no hay que hacer nada para que un niño reciba su constancia; hay
// que hacer algo para que NO la reciba.
//
// Lo único que quita el derecho es `Inscripcion.constanciaExcluida`, que solo
// pone un ADMIN y siempre con motivo, autor y fecha (ver prisma/schema.prisma).
//
// ¿Y `minAsistencias`? Sigue vivo y sigue calculándose, pero ya no decide nada:
// pasó de requisito a indicador. Se sigue mostrando —en el listado de
// constancias y en la ficha del niño— porque es justo el dato que mira el
// coordinador para decidir si excluye a alguien, y porque las ediciones
// anteriores se leen con él. Quitarlo habría borrado esa señal sin sustituirla.
// ─────────────────────────────────────────────────────────────────────────────

// ── Fallos del almacenamiento de archivos ─────────────────────────────────────
// La constancia se arma en memoria y se guarda en el almacenamiento de archivos
// (Supabase Storage). Cuando ese paso falla, antes salía como "Error interno del
// servidor" desde un `catch {}` vacío: nadie podía enterarse desde la app de que
// lo único que faltaba era crear el espacio "constancias". Se distinguen los dos
// motivos porque el arreglo es distinto en cada uno.

/** Faltan las credenciales del almacenamiento en la configuración del servidor. */
export class AlmacenamientoNoConfiguradoError extends Error {
  constructor(causa?: unknown) {
    super(
      "No se pudo guardar la constancia porque el almacenamiento de archivos no está configurado en el servidor. " +
        "La constancia no quedó guardada. Avisa a quien administra el sistema para que complete esa configuración.",
    );
    this.name = "AlmacenamientoNoConfiguradoError";
    this.cause = causa;
  }
}

/** El almacenamiento respondió con un error: espacio inexistente, permisos, caída. */
export class AlmacenamientoNoDisponibleError extends Error {
  constructor(motivo: string) {
    super(
      "No se pudo guardar la constancia porque el almacenamiento de archivos la rechazó. " +
        "El PDF se armó bien, pero no quedó guardado ni se marcó como entregada. " +
        `Avisa a quien administra el sistema y dile esto: el espacio de archivos "constancias" respondió "${motivo}".`,
    );
    this.name = "AlmacenamientoNoDisponibleError";
  }
}

/** La inscripción desapareció entre la comprobación y la generación. */
export class InscripcionNoEncontradaError extends Error {
  constructor() {
    super(
      "No se pudo generar la constancia porque la inscripción ya no existe. " +
        "Vuelve a cargar la página para ver el estado actual del participante.",
    );
    this.name = "InscripcionNoEncontradaError";
  }
}

/**
 * Un ADMIN excluyó a este participante de la entrega de constancias. No es un
 * fallo técnico: es una decisión, y por eso el mensaje la cita en vez de
 * esconderla tras un "no se pudo".
 */
export class ConstanciaExcluidaError extends Error {
  constructor(motivo: string | null) {
    super(
      "No se generó la constancia porque este participante está excluido de la entrega de esta edición" +
        (motivo ? `: «${motivo}»` : "") +
        ". Un administrador puede reincorporarlo desde el apartado de constancias.",
    );
    this.name = "ConstanciaExcluidaError";
  }
}

// ── Estado de la exclusión ────────────────────────────────────────────────────

export type ExclusionConstancia = {
  excluida: boolean;
  motivo: string | null;
  fecha: Date | null;
  /** Quién la puso. Null solo en exclusiones anteriores a este registro. */
  por: { id: string; name: string | null; email: string } | null;
};

/** Campos de exclusión que hay que pedirle a Prisma en cada consulta. */
const SELECT_EXCLUSION = {
  constanciaExcluida: true,
  constanciaMotivoExclusion: true,
  constanciaExcluidaAt: true,
  constanciaExcluidaPor: { select: { id: true, name: true, email: true } },
} as const;

type FilaConExclusion = {
  constanciaExcluida: boolean;
  constanciaMotivoExclusion: string | null;
  constanciaExcluidaAt: Date | null;
  constanciaExcluidaPor: { id: string; name: string | null; email: string } | null;
};

function describirExclusion(fila: FilaConExclusion): ExclusionConstancia {
  return {
    excluida: fila.constanciaExcluida,
    motivo: fila.constanciaMotivoExclusion,
    fecha: fila.constanciaExcluidaAt,
    por: fila.constanciaExcluidaPor,
  };
}

// ── El mínimo de asistencias, ya solo como indicador ──────────────────────────
//
// ESTE es el punto por donde entra el trabajo de "tipos de sesión": cuando una
// sesión de lectura o un evento especial dejen de contar para el mínimo, lo que
// cambia es qué asistencias se suman y cuántas sesiones hay en el denominador,
// no quién recibe constancia. Todo el cálculo vive aquí para que ese cambio sea
// local.

export type ModoMinimo = "global" | "porcentaje" | "por-clase";

type ReglaEdicion = {
  minAsistencias: number;
  porcentajeMinimo: number | null;
  asistenciaGlobal?: boolean;
};

export function evaluarMinimoAsistencias(
  asistio: number,
  totalSesiones: number,
  edicion: ReglaEdicion,
): { cumpleMinimo: boolean; minimo: number; modo: ModoMinimo } {
  if (edicion.porcentajeMinimo !== null && totalSesiones > 0) {
    const pct = (asistio / totalSesiones) * 100;
    return {
      cumpleMinimo: pct >= edicion.porcentajeMinimo,
      minimo: edicion.porcentajeMinimo,
      modo: "porcentaje",
    };
  }

  return {
    cumpleMinimo: asistio >= edicion.minAsistencias,
    minimo: edicion.minAsistencias,
    modo: edicion.asistenciaGlobal === false ? "por-clase" : "global",
  };
}

// ── Elegibilidad de una inscripción ───────────────────────────────────────────

export type ElegibilidadResult = {
  /** Desde el cambio de política: `true` salvo exclusión explícita. */
  elegible: boolean;
  exclusion: ExclusionConstancia;
  /** Informativo: ya no condiciona la constancia. */
  cumpleMinimo: boolean;
  asistencias: number;
  minimo: number;
  constanciaUrl: string | null;
  constanciaGenerada: boolean;
  modo: ModoMinimo;
};

export async function verificarElegibilidad(
  inscripcionId: string,
): Promise<ElegibilidadResult | null> {
  const inscripcion = await prisma.inscripcion.findUnique({
    where: { id: inscripcionId },
    select: {
      constanciaUrl: true,
      constanciaGenerada: true,
      ...SELECT_EXCLUSION,
      edicion: {
        // `select` y no `include`: Prisma no admite los dos en el mismo nivel,
        // y aquí hacen falta campos concretos de la edición. El filtro por tipo
        // se conserva: solo las sesiones que cuentan entran en el denominador.
        select: {
          minAsistencias: true,
          porcentajeMinimo: true,
          asistenciaGlobal: true,
          clases: {
            where: CLASES_QUE_CUENTAN,
            select: { sesiones: { select: { id: true } } },
          },
        },
      },
      asistencias: { where: ASISTENCIAS_QUE_CUENTAN, select: { id: true } },
    },
  });

  if (!inscripcion) return null;

  const { edicion, asistencias, constanciaUrl, constanciaGenerada } = inscripcion;
  const totalSesiones = edicion.clases.flatMap((c) => c.sesiones).length;
  const asistio = asistencias.length;
  const { cumpleMinimo, minimo, modo } = evaluarMinimoAsistencias(
    asistio,
    totalSesiones,
    edicion,
  );
  const exclusion = describirExclusion(inscripcion);

  return {
    elegible: !exclusion.excluida,
    exclusion,
    cumpleMinimo,
    asistencias: asistio,
    minimo,
    constanciaUrl,
    constanciaGenerada,
    modo,
  };
}

// ── Excluir / reincorporar ────────────────────────────────────────────────────
//
// Una sola función para uno y para muchos: el coordinador tiene 59 niños
// delante y lo normal es que actúe en bloque ("estos cinco se dieron de baja").
// Hacer el caso individual con una lista de uno evita dos caminos que puedan
// divergir.
//
// Reincorporar BORRA el motivo, el autor y la fecha: esos campos describen la
// exclusión vigente, no un historial. Si alguna vez hace falta auditar quién
// excluyó y luego reincorporó, eso pide su propia tabla; a día de hoy nadie lo
// ha pedido y guardarlo a medias sería peor que no guardarlo.

export async function actualizarExclusionConstancia(params: {
  inscripcionIds: string[];
  excluida: boolean;
  motivo?: string | null;
  /** Sale SIEMPRE de la sesión del servidor, nunca del cuerpo de la petición. */
  usuarioId: string;
}): Promise<{ actualizadas: number }> {
  const { inscripcionIds, excluida, motivo, usuarioId } = params;

  const data = excluida
    ? {
        constanciaExcluida: true,
        constanciaMotivoExclusion: motivo?.trim() || null,
        constanciaExcluidaAt: new Date(),
        constanciaExcluidaPorId: usuarioId,
      }
    : {
        constanciaExcluida: false,
        constanciaMotivoExclusion: null,
        constanciaExcluidaAt: null,
        constanciaExcluidaPorId: null,
      };

  // Marcar, nunca borrar: las asistencias y la constancia ya emitida se quedan
  // donde están. Excluir a alguien no destruye su historial.
  const { count } = await prisma.inscripcion.updateMany({
    where: { id: { in: inscripcionIds } },
    data,
  });

  return { actualizadas: count };
}

// ── Listado de una edición ────────────────────────────────────────────────────

export type FilaConstancia = {
  inscripcionId: string;
  participante: {
    id: string;
    nombre: string;
    apellidos: string;
    escuela: string;
    grado: string;
  };
  asistencias: number;
  cumpleMinimo: boolean;
  elegible: boolean;
  exclusion: ExclusionConstancia;
  constanciaGenerada: boolean;
  constanciaUrl: string | null;
};

export type ListadoConstancias = {
  edicion: {
    id: string;
    nombre: string;
    anio: number;
    minAsistencias: number;
    porcentajeMinimo: number | null;
    cerrada: boolean;
    totalSesiones: number;
    modo: ModoMinimo;
  };
  filas: FilaConstancia[];
  resumen: {
    inscritos: number;
    conDerecho: number;
    excluidos: number;
    emitidas: number;
    pendientes: number;
  };
};

export async function listarConstanciasDeEdicion(
  edicionId: string,
): Promise<ListadoConstancias | null> {
  const edicion = await prisma.edicion.findUnique({
    where: { id: edicionId },
    select: {
      id: true,
      nombre: true,
      anio: true,
      minAsistencias: true,
      porcentajeMinimo: true,
      asistenciaGlobal: true,
      cerrada: true,
      clases: { select: { sesiones: { select: { id: true } } } },
    },
  });

  if (!edicion) return null;

  const totalSesiones = edicion.clases.flatMap((c) => c.sesiones).length;

  const inscripciones = await prisma.inscripcion.findMany({
    where: { edicionId },
    orderBy: [
      { participante: { apellidos: "asc" } },
      { participante: { nombre: "asc" } },
    ],
    select: {
      id: true,
      constanciaUrl: true,
      constanciaGenerada: true,
      ...SELECT_EXCLUSION,
      participante: {
        select: {
          id: true,
          nombre: true,
          apellidos: true,
          escuela: true,
          grado: true,
        },
      },
      // Solo las presencias confirmadas: una falta registrada no es asistencia.
      _count: { select: { asistencias: { where: { presente: true } } } },
    },
  });

  const filas: FilaConstancia[] = inscripciones.map((i) => {
    const exclusion = describirExclusion(i);
    const asistencias = i._count.asistencias;
    const { cumpleMinimo } = evaluarMinimoAsistencias(
      asistencias,
      totalSesiones,
      edicion,
    );

    return {
      inscripcionId: i.id,
      participante: i.participante,
      asistencias,
      cumpleMinimo,
      elegible: !exclusion.excluida,
      exclusion,
      constanciaGenerada: i.constanciaGenerada,
      constanciaUrl: i.constanciaUrl,
    };
  });

  const excluidos = filas.filter((f) => f.exclusion.excluida).length;
  const emitidas = filas.filter((f) => f.constanciaGenerada).length;
  const conDerecho = filas.length - excluidos;

  const { modo } = evaluarMinimoAsistencias(0, totalSesiones, edicion);

  return {
    edicion: {
      id: edicion.id,
      nombre: edicion.nombre,
      anio: edicion.anio,
      minAsistencias: edicion.minAsistencias,
      porcentajeMinimo: edicion.porcentajeMinimo,
      cerrada: edicion.cerrada,
      totalSesiones,
      modo,
    },
    filas,
    resumen: {
      inscritos: filas.length,
      conDerecho,
      excluidos,
      emitidas,
      pendientes: filas.filter((f) => !f.exclusion.excluida && !f.constanciaGenerada)
        .length,
    },
  };
}

// ── Generar y guardar el PDF ──────────────────────────────────────────────────

export async function generarYGuardarConstancia(
  inscripcionId: string,
): Promise<{ url: string }> {
  const inscripcion = await prisma.inscripcion.findUnique({
    where: { id: inscripcionId },
    include: {
      participante: true,
      edicion: {
        include: {
          clases: {
            where: CLASES_QUE_CUENTAN,
            include: { sesiones: { select: { id: true } } },
          },
        },
      },
      asistencias: { where: ASISTENCIAS_QUE_CUENTAN, select: { id: true } },
    },
  });

  if (!inscripcion) throw new InscripcionNoEncontradaError();

  // Segunda barrera, no la única: la ruta ya lo comprueba antes de llamar. Se
  // repite aquí porque entre una cosa y otra puede haber pasado un minuto, y
  // porque esta función también se llama desde scripts.
  if (inscripcion.constanciaExcluida) {
    throw new ConstanciaExcluidaError(inscripcion.constanciaMotivoExclusion);
  }

  const { participante, edicion, asistencias } = inscripcion;
  const totalSesiones = edicion.clases.flatMap((c) => c.sesiones).length;

  const datos: DatosConstancia = {
    nombre: participante.nombre,
    apellidos: participante.apellidos,
    escuela: participante.escuela,
    grado: participante.grado,
    edicion: { nombre: edicion.nombre, anio: edicion.anio },
    asistencias: asistencias.length,
    totalSesiones,
    // Instante real (no fecha de calendario): se formatea en la zona del
    // programa, porque el servidor de Vercel corre en UTC.
    fechaEmision: formatearInstante(),
  };

  const buffer = await generarPDFConstancia(datos);
  const path = `constancias/${edicion.id}/${inscripcionId}.pdf`;

  let admin;
  try {
    admin = getSupabaseAdmin();
  } catch (err) {
    throw new AlmacenamientoNoConfiguradoError(err);
  }

  const { error } = await admin.storage
    .from("constancias")
    .upload(path, buffer, { contentType: "application/pdf", upsert: true });

  // `error.message` viene del servicio de almacenamiento ("Bucket not found",
  // "new row violates row-level security policy"…). No es una traza ni una ruta
  // interna: es justo el dato que le falta a quien administra para arreglarlo.
  if (error) throw new AlmacenamientoNoDisponibleError(error.message);

  const {
    data: { publicUrl },
  } = admin.storage.from("constancias").getPublicUrl(path);

  await prisma.inscripcion.update({
    where: { id: inscripcionId },
    data: { constanciaUrl: publicUrl, constanciaGenerada: true },
  });

  return { url: publicUrl };
}
