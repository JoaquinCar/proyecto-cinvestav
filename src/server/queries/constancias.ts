import { prisma } from "@/server/db";
import { getSupabaseAdmin } from "@/lib/supabase";
import { generarPDFConstancia, type DatosConstancia } from "@/lib/pdf/constancia";

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

  if (!inscripcion) throw new Error("Inscripción no encontrada");

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
    fechaEmision: new Date().toLocaleDateString("es-MX", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
  };

  const buffer = await generarPDFConstancia(datos);
  const path = `constancias/${edicion.id}/${inscripcionId}.pdf`;

  const admin = getSupabaseAdmin();
  const { error } = await admin.storage
    .from("constancias")
    .upload(path, buffer, { contentType: "application/pdf", upsert: true });

  if (error) throw new Error(`Error al subir PDF: ${error.message}`);

  const {
    data: { publicUrl },
  } = admin.storage.from("constancias").getPublicUrl(path);

  await prisma.inscripcion.update({
    where: { id: inscripcionId },
    data: { constanciaUrl: publicUrl, constanciaGenerada: true },
  });

  return { url: publicUrl };
}
