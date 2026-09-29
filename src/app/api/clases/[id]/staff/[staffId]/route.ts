import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  quitarStaffDeClase,
  AsignacionNoEncontradaError,
} from "@/server/queries/staff";
import { fallaInesperada } from "@/server/respuestas";

// ── DELETE /api/clases/[id]/staff/[staffId] ───────────────────────────────────
//
// Quita a una persona de ESTA sesión. NO borra su ficha: casi siempre está
// asignada a otras sesiones, y aunque no lo esté, sigue disponible para el año
// que viene. Es el mismo criterio que DELETE /api/inscripciones/[id]/acompanante.
//
// ADMIN y BECARIO. READONLY solo consulta.

const ASIGNACION_NO_ENCONTRADA =
  "Esa persona ya no figura en esta sesión: alguien pudo quitarla desde otra pantalla. Vuelve a cargar la página para ver quién está asignado.";

const ENLACE_INCOMPLETO =
  "El enlace está incompleto. Vuelve a abrirlo desde la página de la sesión.";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; staffId: string }> },
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { role } = session.user;
  if (role !== "ADMIN" && role !== "BECARIO") {
    return NextResponse.json({ error: "Permiso insuficiente" }, { status: 403 });
  }

  const { id, staffId } = await params;
  if (!id || !staffId) {
    return NextResponse.json({ error: ENLACE_INCOMPLETO }, { status: 400 });
  }

  try {
    await quitarStaffDeClase(id, staffId);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    if (err instanceof AsignacionNoEncontradaError) {
      return NextResponse.json(
        { error: ASIGNACION_NO_ENCONTRADA },
        { status: 404 },
      );
    }
    return fallaInesperada(
      "DELETE /api/clases/[id]/staff/[staffId]",
      err,
      "No se pudo quitar a esta persona; la sesión sigue como estaba. Vuelve a intentarlo en unos minutos.",
    );
  }
}
