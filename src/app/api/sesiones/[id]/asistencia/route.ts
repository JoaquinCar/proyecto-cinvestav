import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { obtenerSesionPorId } from "@/server/queries/clases";
import {
  obtenerAsistenciasDeSesion,
  obtenerResumenAsistencia,
} from "@/server/queries/asistencias";

type RouteContext = { params: Promise<{ id: string }> };

// ── GET /api/sesiones/[id]/asistencia ─────────────────────────────────────────
// Devuelve la lista de inscripciones con su estado de asistencia para la sesión,
// más el resumen (total/presentes/ausentes).
// Disponible para cualquier rol autenticado (ADMIN, BECARIO, READONLY).

export async function GET(_request: Request, context: RouteContext) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id } = await context.params;

    const sesion = await obtenerSesionPorId(id);
    if (!sesion) {
      return NextResponse.json({ error: "Sesión no encontrada" }, { status: 404 });
    }

    const [asistencias, resumen] = await Promise.all([
      obtenerAsistenciasDeSesion(id),
      obtenerResumenAsistencia(id),
    ]);

    return NextResponse.json({ asistencias, resumen });
  } catch {
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}
