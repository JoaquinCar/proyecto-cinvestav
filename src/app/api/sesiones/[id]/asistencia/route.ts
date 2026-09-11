import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { obtenerSesionPorId } from "@/server/queries/clases";
import {
  obtenerAsistenciasDeSesion,
  obtenerResumenAsistencia,
} from "@/server/queries/asistencias";
import { fallaInesperada } from "@/server/respuestas";

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
      return NextResponse.json(
        {
          error:
            "Esta sesión ya no existe: alguien pudo eliminarla. Vuelve a la página de la clase para ver las sesiones actuales.",
        },
        { status: 404 },
      );
    }

    const [asistencias, resumen] = await Promise.all([
      obtenerAsistenciasDeSesion(id),
      obtenerResumenAsistencia(id),
    ]);

    return NextResponse.json({ asistencias, resumen });
  } catch (error) {
    return fallaInesperada(
      "GET /api/sesiones/[id]/asistencia",
      error,
      "No se pudo cargar la lista de asistencia. Revisa tu conexión y vuelve a intentarlo en unos momentos.",
    );
  }
}
