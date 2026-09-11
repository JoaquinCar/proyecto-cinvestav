import { prisma } from "@/server/db";
import { getSupabaseAdmin } from "@/lib/supabase";
import { generarPDFConstancia, type DatosConstancia } from "@/lib/pdf/constancia";
import { formatearInstante } from "@/lib/fechas";

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

export type ElegibilidadResult = {
  elegible: boolean;
  asistencias: number;
  minimo: number;
  constanciaUrl: string | null;
  constanciaGenerada: boolean;
  modo: "global" | "porcentaje" | "por-clase";
};

export async function verificarElegibilidad(
  inscripcionId: string,
): Promise<ElegibilidadResult | null> {
  const inscripcion = await prisma.inscripcion.findUnique({
    where: { id: inscripcionId },
    include: {
      edicion: {
        include: {
          clases: { include: { sesiones: { select: { id: true } } } },
        },
      },
      asistencias: { where: { presente: true }, select: { id: true } },
    },
  });

  if (!inscripcion) return null;

  const { edicion, asistencias, constanciaUrl, constanciaGenerada } = inscripcion;
  const totalSesiones = edicion.clases.flatMap((c) => c.sesiones).length;
  const asistio = asistencias.length;

  if (edicion.porcentajeMinimo !== null && totalSesiones > 0) {
    const pct = (asistio / totalSesiones) * 100;
    return {
      elegible: pct >= edicion.porcentajeMinimo,
      asistencias: asistio,
      minimo: edicion.porcentajeMinimo,
      constanciaUrl,
      constanciaGenerada,
      modo: "porcentaje",
    };
  }

  return {
    elegible: asistio >= edicion.minAsistencias,
    asistencias: asistio,
    minimo: edicion.minAsistencias,
    constanciaUrl,
    constanciaGenerada,
    modo: edicion.asistenciaGlobal ? "global" : "por-clase",
  };
}

export async function generarYGuardarConstancia(
  inscripcionId: string,
): Promise<{ url: string }> {
  const inscripcion = await prisma.inscripcion.findUnique({
    where: { id: inscripcionId },
    include: {
      participante: true,
      edicion: {
        include: {
          clases: { include: { sesiones: { select: { id: true } } } },
        },
      },
      asistencias: { where: { presente: true }, select: { id: true } },
    },
  });

  if (!inscripcion) throw new InscripcionNoEncontradaError();

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
